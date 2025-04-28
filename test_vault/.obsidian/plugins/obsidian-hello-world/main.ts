import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';
import { ExampleView, VIEW_TYPE_EXAMPLE } from './view';

interface HelloWorldSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: HelloWorldSettings = {
	mySetting: ''
}

export default class HelloWorldPlugin extends Plugin {
	settings: HelloWorldSettings;

	async onload() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

		this.registerView(
			VIEW_TYPE_EXAMPLE,
			(leaf) => new ExampleView(leaf)
		);

		this.addRibbonIcon('dice', 'List Contents of Vault', () => {
			this.activateView();
		})

		this.addRibbonIcon('dice', 'Greet', () =>{
			new Notice('Hello, world!');
		})
	}

	onunload() {

	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async activateView() 
	{
		const { workspace } = this.app;
		
		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_EXAMPLE);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({type:VIEW_TYPE_EXAMPLE, active: true});
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
			
			// Get all markdown files
			const markdownFiles = this.app.vault.getMarkdownFiles();
			
			// Pass markdown files to the view
			const view = leaf.view as ExampleView;
			view.updateFiles(markdownFiles);
		}
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: HelloWorldPlugin;

	constructor(app: App, plugin: HelloWorldPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
