import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, TFile } from 'obsidian';
import { ExampleView, VIEW_TYPE_EXAMPLE } from './view';

import axios from 'axios';

interface Message {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

interface CompletionRequest {
	model: string;
	messages: Message[];
	temperature?: number;
	max_tokens?: number;
  }
  
  interface CompletionResponse {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: {
	  index: number;
	  message: Message;
	  finish_reason: string;
	}[];
	usage: {
	  prompt_tokens: number;
	  completion_tokens: number;
	  total_tokens: number;
	};
  }

async function callLMStudioAPI(prompt: string): Promise<string> {
	console.log("Calling LM Studio API with prompt:");
  try {
    const response = await axios.post<CompletionResponse>(
      'http://localhost:3001/v1/chat/completions',
      {
        model: 'local model',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1000
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log("API response status:", response.status);
    return response.data.choices[0].message.content;
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED') {
        console.error('Connection refused - Is LM Studio API server running on port 3001?');
      } else if (error.response) {
        console.error('LM Studio API error:', error.response.status, error.response.data);
      } else if (error.request) {
        console.error('No response received from LM Studio API. Is the server running?');
      }
    }
    console.error('Error calling LM Studio API:', error);
    throw error;
  }
}

interface LearnPluginSettings {
	summarizeOnOpen: boolean;
	keyPointsPrefix: string;
}

const DEFAULT_SETTINGS: LearnPluginSettings = {
	summarizeOnOpen: true,
	keyPointsPrefix: '- '
}

export default class LearnPlugin extends Plugin {
	settings: LearnPluginSettings = DEFAULT_SETTINGS;
	summaries: Map<string, string> = new Map();

	async onload() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

		this.registerView(
			VIEW_TYPE_EXAMPLE,
			(leaf) => new ExampleView(leaf)
		);

		this.addRibbonIcon('list-ordered', 'Summarize Notes', () => {
			this.summarizeNotes();
		});

		// Add settings tab
		this.addSettingTab(new LearnSettingTab(this.app, this));
	}

	onunload() {
		// Clean up resources
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async summarizeNotes() {
		const { workspace } = this.app;
		
		// Show loading notice
		new Notice('Summarizing notes...');
		
		// Get all markdown files
		const markdownFiles = this.app.vault.getMarkdownFiles();
		
		// Process each file to extract key points
		this.summaries = new Map();
		for (const file of markdownFiles) {
			const summary = await this.extractKeyPoints(file);
			if (summary) {
				this.summaries.set(file.path, summary);
			}
		}
		
		// Activate view to display results
		await this.activateView();
		
		new Notice(`Summarized ${this.summaries.size} notes`);
	}
	

	async extractKeyPoints(file: TFile): Promise<string> {
		// Read file content
		const content = await this.app.vault.read(file);
		
		// Skip empty files
		if (!content.trim()) {
			return "";
		}

		try {
			// Build a prompt for the AI to extract key points
			const prompt = `Extract 3-5 key points from this note in bullet point format:
			
${content}`;
			
			// Call the LM Studio API with the note content
			const result = await callLMStudioAPI(prompt);
			console.log(`Key points extracted for ${file.basename}:`, result);
			return result;
		} catch (error) {
			console.error(`Failed to extract key points for ${file.basename}:`, error);
			return "Failed to extract key points - API error";
		}
	}

	async activateView() {
		const { workspace } = this.app;
		
		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_EXAMPLE);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({type: VIEW_TYPE_EXAMPLE, active: true});
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
			
			// Get all markdown files
			const markdownFiles = this.app.vault.getMarkdownFiles();
			
			// Pass markdown files and summaries to the view
			const view = leaf.view as ExampleView;
			view.updateFiles(markdownFiles);
			view.updateSummaries(this.summaries);
		}
	}
}

class LearnSettingTab extends PluginSettingTab {
	plugin: LearnPlugin;

	constructor(app: App, plugin: LearnPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Learn Plugin Settings'});

		new Setting(containerEl)
			.setName('Summarize on Open')
			.setDesc('Automatically summarize notes when the summary view is opened')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.summarizeOnOpen)
				.onChange(async (value) => {
					this.plugin.settings.summarizeOnOpen = value;
					await this.plugin.saveSettings();
				}));
				
		new Setting(containerEl)
			.setName('Bullet Point Prefix')
			.setDesc('The prefix to identify bullet points (e.g., "- ", "* ", "+ ")')
			.addText(text => text
				.setValue(this.plugin.settings.keyPointsPrefix)
				.onChange(async (value) => {
					this.plugin.settings.keyPointsPrefix = value;
					await this.plugin.saveSettings();
				}));
	}
}
