/**
 * HierarchicalManager
 *
 * Provides optimized implementation for the hierarchical process execution in CrewAI.
 * This manager handles task delegation, parallel execution, and synthesis to maximize
 * performance and resource utilization.
 */
import { Agent } from '../agent/Agent.js';
/**
 * HierarchicalManager handles the intelligent orchestration of tasks
 * using a manager agent for optimal execution planning and resource allocation.
 */
export class HierarchicalManager {
    /**
     * Create a manager agent for hierarchical process execution
     */
    static async createManagerAgent(config) {
        // If manager agent is already provided, use it
        if (config.managerAgent) {
            return config.managerAgent;
        }
        // Use the provided manager LLM or default to a capable model
        const llm = typeof config.managerLlm === 'string'
            ? { modelName: config.managerLlm } // Convert string to object with modelName
            : config.managerLlm;
        // Create the manager agent with optimized settings
        const managerConfig = {
            role: 'Manager',
            goal: 'Coordinate task execution for optimal results',
            backstory: 'An expert coordinator who excels at organizing complex workflows',
            llm,
            verbose: config.verbose,
            memory: config.memory,
            allowDelegation: false // Manager itself shouldn't delegate
        };
        return new Agent(managerConfig);
    }
    /**
     * Create an execution plan using the manager agent.
     * Optimized for minimal token usage and efficient planning.
     */
    static async createExecutionPlan(manager, tasks, context) {
        // Create a planning task for the manager
        const planningTask = {
            description: 'Create an optimal execution plan for the tasks',
            role: 'execution_planner',
            goal: 'Determine the most efficient task execution order'
        };
        // Prepare task information for the manager
        const taskInfo = tasks.map(task => ({
            id: task.id,
            description: task.description,
            agent: { role: task.agent.role },
            priority: task.priority || 'medium',
            isAsync: task.isAsync || false
        }));
        // Execution plan prompt with built-in performance optimization guidance
        const planPrompt = `
      You are organizing the execution of a workflow with the following tasks:

      ${JSON.stringify(taskInfo, null, 2)}

      Based on task dependencies, priorities, and potential for parallelization, create an execution plan.
      Your plan should include:
      1. The optimal order of task execution (provide task IDs in sequence)
      2. Any tasks that can be executed in parallel (group them by numbers)
      3. Which task results should be included in the context for subsequent tasks
      4. Whether a final synthesis of all results is required

      For parallelization, group task IDs that can run concurrently and assign each group a number.
      
      Your response should be in JSON format:
      {
        "taskOrder": ["task-id-1", 1, "task-id-3", ...],
        "parallelGroups": { "1": ["task-id-2", "task-id-4"], ... },
        "significantTasks": ["task-id-1", "task-id-3", ...],
        "synthesisRequired": true/false
      }
      
      Where:
      - "taskOrder" is the sequence of execution, with numbers representing parallel groups
      - "parallelGroups" maps group numbers to arrays of task IDs that can run in parallel
      - "significantTasks" lists tasks whose results should be included in context
      - "synthesisRequired" indicates if a final synthesis of all results is needed

      Current context: ${context}
    `;
        try {
            // Execute the planning task
            const executionContext = {
                task: planningTask,
                context: planPrompt,
                tools: []
            };
            // Use the executeTask method defined in BaseAgent interface
            const planningResult = await manager.executeTask({ id: 'planning-task', description: planningTask.description, agent: manager }, planPrompt, []);
            if (!planningResult || !planningResult.output) {
                throw new Error('Planning failed: No output from manager agent');
            }
            // Parse and validate the execution plan
            let plan;
            try {
                // Extract JSON from the response (in case there's additional text)
                const jsonMatch = planningResult.output.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new Error('No valid JSON found in planning output');
                }
                plan = JSON.parse(jsonMatch[0]);
            }
            catch (parseError) {
                console.error('Error parsing plan JSON:', parseError);
                throw new Error(`Invalid execution plan format: ${parseError.message}`);
            }
            // Validate the plan structure
            if (!plan.taskOrder || !Array.isArray(plan.taskOrder)) {
                throw new Error('Invalid execution plan: missing or invalid taskOrder');
            }
            if (!plan.parallelGroups || typeof plan.parallelGroups !== 'object') {
                plan.parallelGroups = {};
            }
            return plan;
        }
        catch (error) {
            console.error('Error parsing execution plan:', error);
            // Fallback to a simple sequential plan if parsing fails
            return {
                taskOrder: tasks.map(t => t.id),
                parallelGroups: {},
                synthesisRequired: false
            };
        }
    }
    /**
     * Efficiently manages execution of tasks according to the execution plan.
     * Optimized for parallel execution and memory usage.
     */
    static async executeTasksWithPlan(plan, tasks, context, options) {
        // Track completed tasks and their results
        const completedTaskIds = new Set();
        let overallContext = context || '';
        let finalOutput = '';
        // Map of task IDs to tasks for efficient lookup
        const taskMap = new Map(tasks.map(task => [task.id, task]));
        // First, execute tasks in the specified order (including parallel groups)
        for (const item of plan.taskOrder) {
            // If this is a parallel group ID, process it
            if (typeof item === 'number' && plan.parallelGroups[item]) {
                const group = plan.parallelGroups[item];
                if (options.verbose) {
                    console.log(`Executing parallel task group ${item} with ${group.length} tasks`);
                }
                // Run tasks in this group in parallel
                const parallelResults = await Promise.all(group.map(async (taskId) => {
                    const task = taskMap.get(taskId);
                    if (!task) {
                        throw new Error(`Task ${taskId} not found in execution plan`);
                    }
                    // Execute the task with the current context
                    return options.executeTask(task, overallContext);
                }));
                // Process results from parallel execution
                for (let i = 0; i < group.length; i++) {
                    const taskId = group[i];
                    const output = parallelResults[i];
                    // Mark task as completed with type safety
                    if (taskId && typeof taskId === 'string') {
                        completedTaskIds.add(taskId);
                        // Add to context if it's significant (determined by manager)
                        const significant = (taskId && plan.significantTasks?.includes(taskId)) ?? true;
                        if (significant && output && output.result) {
                            overallContext += `\n\nTask result: ${output.result}`;
                            // Update potential final output
                            finalOutput = output.result;
                        }
                    }
                }
            }
            else if (typeof item === 'string') {
                // Regular sequential task execution
                const taskId = item;
                const task = taskMap.get(taskId);
                if (!task) {
                    throw new Error(`Task ${taskId} not found in execution plan`);
                }
                if (options.verbose) {
                    console.log(`Executing sequential task: ${task.description}`);
                }
                // Execute the task with the current context
                const output = await options.executeTask(task, overallContext);
                // Mark task as completed
                completedTaskIds.add(taskId);
                // Add to context if it's significant
                const significant = plan.significantTasks?.includes(taskId) ?? true;
                if (significant && output && output.result) {
                    overallContext += `\n\nTask result: ${output.result}`;
                    // Update potential final output (last significant task result)
                    finalOutput = output.result;
                }
            }
        }
        return {
            finalOutput,
            completedTaskIds,
            context: overallContext
        };
    }
}
//# sourceMappingURL=HierarchicalManager.js.map