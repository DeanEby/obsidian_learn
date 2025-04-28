import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, TFile } from 'obsidian';
import { ExampleView, VIEW_TYPE_EXAMPLE } from './view';

interface LearnPluginSettings {
	summarizeOnOpen: boolean;
	keyPointsPrefix: string;
}

const DEFAULT_SETTINGS: LearnPluginSettings = {
	summarizeOnOpen: true,
	keyPointsPrefix: '- '
}

export default class LearnPlugin extends Plugin {
	settings: LearnPluginSettings;
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
		
		// Extract potential key points - basic implementation
		// Look for bullet points, headings, and emphasized text
		const lines = content.split('\n');
		const keyPoints: string[] = [];
		
		// Extract bullet points (most likely to be key points)
		const bulletPoints = lines.filter(line => 
			line.trim().startsWith(this.settings.keyPointsPrefix) || 
			line.trim().startsWith('* ') || 
			line.trim().startsWith('+ ')
		);
		
		if (bulletPoints.length > 0) {
			keyPoints.push(...bulletPoints.slice(0, 5)); // Limit to top 5 bullet points
		}
		
		// Extract headings if no bullet points found
		if (keyPoints.length === 0) {
			const headings = lines.filter(line => 
				line.trim().startsWith('#') && 
				!line.trim().startsWith('##')
			);
			
			if (headings.length > 0) {
				keyPoints.push(...headings.slice(0, 3));
			}
		}
		
		// Extract emphasized text if still no key points
		if (keyPoints.length === 0) {
			// Look for bold or italic text
			const emphasisRegex = /\*\*(.+?)\*\*|\*(.+?)\*|__(.+?)__|_(.+?)_/g;
			let match;
			const emphasisPoints: string[] = [];
			
			while ((match = emphasisRegex.exec(content)) !== null) {
				const emphText = match[1] || match[2] || match[3] || match[4];
				if (emphText && emphText.length > 10) { // Only meaningful emphasis
					emphasisPoints.push(`- ${emphText}`);
				}
			}
			
			if (emphasisPoints.length > 0) {
				keyPoints.push(...emphasisPoints.slice(0, 3));
			}
		}
		
		// If still no key points, take first paragraph
		if (keyPoints.length === 0) {
			let paragraph = "";
			for (const line of lines) {
				if (line.trim().length > 0) {
					paragraph += line + " ";
					if (paragraph.length > 150) break;
				} else if (paragraph.length > 0) {
					break;
				}
			}
			
			if (paragraph) {
				keyPoints.push(`- ${paragraph.trim()}`);
			}
		}
		
		return keyPoints.join('\n');
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
