import { IExecuteFunctions } from 'n8n-workflow';
import {
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { spawn } from 'child_process';

export class WslExec implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'WSL Exec',
		name: 'wslExec',
		icon: 'file:wslExec.svg',
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
				type: 'string',
				default: '',
				placeholder: 'e.g., Ubuntu-20.04',
				description: 'The name of the WSL2 container to execute the command in',
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
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			const wslContainer = this.getNodeParameter('wslContainer', i, '') as string;
			const startDirectory = this.getNodeParameter('startDirectory', i, '~/') as string;
			const command = this.getNodeParameter('command', i, '') as string;
			const args = this.getNodeParameter('args', i, '') as string;

			const fullCommand = `cd ${startDirectory} && ${command} ${args}`;

			const wslProcess = spawn('wsl', ['-d', wslContainer, '-e', 'bash', '-ic', fullCommand]);

			let stdout = '';
			let stderr = '';

			wslProcess.stdout.on('data', (data: Buffer) => {
				stdout += data.toString();
				// Not logging stdout to execution log by default to avoid clutter
			});

			wslProcess.stderr.on('data', (data: Buffer) => {
				stderr += data.toString();
				// Will be returned in the output
			});

			const exitCode = await new Promise<number>((resolve) => {
				wslProcess.on('close', (code: number | null) => {
					resolve(code ?? 0);
				});
			});

			returnData.push({
				json: {
					...items[i].json,
					stdout,
					stderr,
					exitCode,
				},
			});
		}

		return this.prepareOutputData(returnData);
	}
}
