import { IExecuteFunctions, ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
import {
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class WslExec implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'WSL Exec',
		name: 'wslExec',
		icon: 'file:WslExec.node.icon.svg',
		group: ['transform'],
		version: 1,
		description: 'Executes a command in a WSL2 container',
		defaults: {
			name: 'WSL Exec',
		},
		inputs: ['main'] as any,
		outputs: ['main'] as any,
		properties: [
			{
				displayName: 'WSL2 Container',
				name: 'wslContainer',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getWslContainers',
				},
				default: '',
				description: 'Choose a WSL container or type a name. It will be automatically discovered.',
				required: true,
			},
			{
				displayName: 'Start Directory',
				name: 'startDirectory',
				type: 'string',
				default: '~/',
				description: 'The directory to start in. Defaults to the home directory (~/).',
			},
			{
				displayName: 'Command',
				name: 'command',
				type: 'string',
				default: '',
				placeholder: 'e.g., ls',
				description: 'The command to execute',
				required: true,
			},
			{
				displayName: 'Arguments',
				name: 'args',
				type: 'string',
				default: '',
				description: 'Arguments for the command, separated by spaces',
			},
			{
				displayName: 'Ignore Startup Output',
				name: 'ignoreStartupOutput',
				type: 'boolean',
				default: false,
				description: 'Ignores output from shell startup scripts (e.g., .bashrc)',
			},
			{
				displayName: 'Split Output by Line',
				name: 'splitOutputByLine',
				type: 'boolean',
				default: false,
				description: 'Whether to split the stdout into an array of strings, one for each line',
			},
		],
	};

	methods = {
		loadOptions: {
			async getWslContainers(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					// The --quiet flag removes the header, and we specify utf16le encoding for PowerShell
					const { stdout } = await execAsync('wsl -l --quiet', { encoding: 'utf16le' });
					const containers = stdout
						.split('\n')
						.map((line) => line.trim())
						.filter((line) => line)
						.map((name) => ({
							name,
							value: name,
						}));
					return containers;
				} catch (error) {
					// If WSL is not installed or an error occurs, return an empty list
					this.logger.error(`Could not list WSL containers: ${error}`);
					return [];
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			const wslContainer = this.getNodeParameter('wslContainer', i, '') as string;
			const startDirectory = this.getNodeParameter('startDirectory', i, '~/') as string;
			const command = this.getNodeParameter('command', i, '') as string;
			const args = this.getNodeParameter('args', i, '') as string;
			const ignoreStartupOutput = this.getNodeParameter('ignoreStartupOutput', i, false) as boolean;
			const splitOutputByLine = this.getNodeParameter('splitOutputByLine', i, false) as boolean;

			const START_MARKER = '---N8N_WSL_EXEC_START---';
			const END_MARKER = '---N8N_WSL_EXEC_END---';

			let commandToRun = `cd ${startDirectory} && ${command} ${args}`;
			if (ignoreStartupOutput) {
				commandToRun = `cd ${startDirectory} && echo "${START_MARKER}" && ${command} ${args}; echo "${END_MARKER}"`;
			}

			const wslProcess = spawn('wsl', ['-d', wslContainer, '-e', 'bash', '-ic', commandToRun]);

			let stdout = '';
			let stderr = '';

			wslProcess.stdout.on('data', (data: Buffer) => {
				stdout += data.toString();
			});

			wslProcess.stderr.on('data', (data: Buffer) => {
				stderr += data.toString();
			});

			const exitCode = await new Promise<number>((resolve) => {
				wslProcess.on('close', (code: number | null) => {
					resolve(code ?? 0);
				});
			});

			let finalStdout: string | string[] = stdout;
			if (ignoreStartupOutput) {
				const startIndex = stdout.indexOf(START_MARKER);
				const endIndex = stdout.lastIndexOf(END_MARKER);
				if (startIndex !== -1 && endIndex !== -1) {
					finalStdout = stdout.substring(startIndex + START_MARKER.length, endIndex).trim();
				}
			}

			if (splitOutputByLine) {
				finalStdout = (finalStdout as string).split('\n').filter(line => line);
			}

			returnData.push({
				json: {
					...items[i].json,
					stdout: finalStdout,
					stderr,
					exitCode,
				},
			});
		}

		return this.prepareOutputData(returnData);
	}
}
