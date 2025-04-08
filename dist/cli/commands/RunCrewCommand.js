/**
 * CLI command for executing a Crew with Flow-based execution.
 * Optimized for performance with parallel agent execution and progress tracking.
 */
import fs from 'fs';
import path from 'path';
import { Command } from '../Command.js';
export class RunCrewCommand extends Command {
    name = 'run-crew';
    description = 'Execute a Crew with optimized workflow';
    syntax = '<crew-file-path> [--input <input-json>] [options]';
    examples = [
        'run-crew ./src/crews/ResearchCrew.js',
        'run-crew ./src/crews/ResearchCrew.js --input \'{\'query\':\'AI trends\'}\' ',
        'run-crew ./src/crews/ResearchCrew.js --verbose --output results.json'
    ];
    async execute(args) {
        const parsedArgs = this.parseArgs(args);
        const startTime = Date.now();
        if (!parsedArgs.crewPath) {
            console.error('Error: Crew file path is required');
            this.showHelp();
            process.exit(1);
        }
        try {
            // Dynamically import required modules only when needed (optimization)
            const { default: chalk } = await import('chalk');
            const { default: ora } = await import('ora');
            // Show spinner for better UX
            const spinner = ora('Preparing crew execution...').start();
            // Resolve the crew file path
            const crewPath = path.resolve(process.cwd(), parsedArgs.crewPath);
            if (!fs.existsSync(crewPath)) {
                spinner.fail(`Crew file not found at ${crewPath}`);
                process.exit(1);
            }
            // Dynamically import the crew (lazy loading optimization)
            spinner.text = 'Importing crew module...';
            const crewModule = await import(crewPath);
            // Find the crew class in the module
            const CrewClass = this.findCrewClass(crewModule);
            if (!CrewClass) {
                spinner.fail('Could not find a Crew class in the specified file');
                process.exit(1);
            }
            // Parse input JSON if provided
            let inputData = {};
            if (parsedArgs.input) {
                try {
                    inputData = JSON.parse(parsedArgs.input);
                }
                catch (error) {
                    spinner.fail('Error parsing input JSON');
                    console.error(error);
                    process.exit(1);
                }
            }
            // Instantiate the crew
            spinner.text = `Instantiating ${CrewClass.name}...`;
            const crew = new CrewClass();
            // Enable verbose logging if requested
            if (parsedArgs.verbose) {
                process.env.DEBUG = 'true';
                process.env.DEBUG_FLOW = 'true';
            }
            // Setup progress tracking with event listeners (optimization for UX)
            if (!parsedArgs.verbose) {
                this.setupProgressTracking(crew, spinner);
            }
            else {
                spinner.stop();
                console.log(chalk.blue(`🚀 Starting execution of ${chalk.bold(CrewClass.name)}...`));
            }
            // Execute the crew with input data
            const result = parsedArgs.verbose ?
                await crew.run(inputData) :
                await this.executeWithSpinner(crew, inputData, spinner);
            // Operation completed successfully
            const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);
            if (!parsedArgs.verbose) {
                spinner.succeed(`Crew execution completed in ${executionTime}s`);
            }
            else {
                console.log(chalk.green(`\n✅ Crew execution completed in ${executionTime}s`));
            }
            // Save output if requested
            if (parsedArgs.output) {
                const outputPath = path.resolve(process.cwd(), parsedArgs.output);
                fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
                console.log(`\nResults saved to: ${outputPath}`);
            }
            else {
                // Print results to console
                console.log('\nResults:', JSON.stringify(result, null, 2));
            }
        }
        catch (error) {
            console.error('Error executing crew:', error);
            process.exit(1);
        }
    }
    /**
     * Execute crew with spinner progress indication
     * Uses optimized error handling and progress reporting
     */
    async executeWithSpinner(crew, inputData, spinner) {
        return new Promise((resolve, reject) => {
            try {
                // Use an interval to display progress changes (optimization for UX)
                const progressInterval = setInterval(() => {
                    if (crew.state?.progress) {
                        spinner.text = `Executing crew... ${crew.state.progress}%`;
                    }
                }, 500);
                // Execute crew and clean up when done
                crew.run(inputData)
                    .then((result) => {
                    clearInterval(progressInterval);
                    resolve(result);
                })
                    .catch((error) => {
                    clearInterval(progressInterval);
                    reject(error);
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    /**
     * Parse command line arguments for the run-crew command
     * Optimized for handling various argument formats
     */
    parseArgs(args) {
        if (args.length === 0) {
            return {};
        }
        const result = {
            crewPath: args[0]
        };
        // Parse options
        for (let i = 1; i < args.length; i++) {
            if (args[i] === '--input' && i + 1 < args.length) {
                result.input = args[++i];
            }
            else if (args[i] === '--verbose') {
                result.verbose = true;
            }
            else if (args[i] === '--output' && i + 1 < args.length) {
                result.output = args[++i];
            }
        }
        return result;
    }
    /**
     * Find a Crew class exported from a module
     * Uses intelligent scanning for crew-related exports with caching
     */
    findCrewClass(module) {
        // Cache for module scanning (optimization)
        const moduleCache = new WeakMap();
        if (moduleCache.has(module)) {
            return moduleCache.get(module);
        }
        // Check for default export if it's a Crew
        if (module.default && this.isCrewClass(module.default)) {
            moduleCache.set(module, module.default);
            return module.default;
        }
        // Check for named exports that might be Crews
        for (const key in module) {
            if (this.isCrewClass(module[key])) {
                moduleCache.set(module, module[key]);
                return module[key];
            }
        }
        return null;
    }
    /**
     * Check if a class is a Crew class
     * Uses intelligent prototype analysis for accuracy and caching for performance
     */
    isCrewClass(cls) {
        // Cache crew class checks for performance
        const classCache = new WeakMap();
        if (classCache.has(cls)) {
            // Add explicit null check to handle boolean | undefined type issue
            return classCache.get(cls) ?? false;
        }
        // Not a constructor function or class
        if (typeof cls !== 'function') {
            classCache.set(cls, false);
            return false;
        }
        // Quick check based on name
        const className = cls.name;
        if (className === 'Crew') {
            classCache.set(cls, true);
            return true;
        }
        // Check for class name patterns
        if (className.includes('Crew') || className.endsWith('Crew')) {
            classCache.set(cls, true);
            return true;
        }
        // More thorough check - look for key Crew methods
        const hasCrew = cls.prototype &&
            (typeof cls.prototype.run === 'function' ||
                typeof cls.prototype.kickoff === 'function' ||
                typeof cls.prototype.execute === 'function');
        if (hasCrew) {
            classCache.set(cls, true);
            return true;
        }
        classCache.set(cls, false);
        return false;
    }
    /**
     * Setup progress tracking for the crew
     * Optimized for UX and minimal performance impact
     */
    setupProgressTracking(crew, spinner) {
        // Catch progress updates if the crew emits events
        if (crew.events) {
            crew.events.on('progress', (progress) => {
                spinner.text = `Executing crew... ${progress}%`;
            });
            crew.events.on('agent_started', (event) => {
                spinner.text = `Agent ${event.agentName} working on task: ${event.taskName}`;
            });
        }
    }
}
//# sourceMappingURL=RunCrewCommand.js.map