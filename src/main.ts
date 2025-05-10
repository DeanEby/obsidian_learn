import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, TFile } from 'obsidian';
import { ExampleView, VIEW_TYPE_EXAMPLE } from './view';
import { QuizView, VIEW_TYPE_QUIZ, Question } from './quiz';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { cleanJsonResponse } from 'src/cleanJsonResponse';

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
	dbFolderPath: string;
	alwaysRedistill: boolean;
}

const DEFAULT_SETTINGS: LearnPluginSettings = {
	summarizeOnOpen: true,
	keyPointsPrefix: '- ',
	dbFolderPath: 'obsidian-learn-db',
	alwaysRedistill: false
}

// Interface for the structure of the JSON data file
interface NoteData {
	uuid: string;
	notePath: string;
	lastUpdated: number;
	distilledContent: {
		facts: string[];
		definitions: { term: string; definition: string }[];
		quotes: string[];
		keyPoints: string[];
	};
	quizData: Question[];
}

export default class LearnPlugin extends Plugin {
	settings: LearnPluginSettings = DEFAULT_SETTINGS;
	summaries: Map<string, string> = new Map();
	currentQuizFile: TFile | null = null;

	async onload() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

		// Register summary view
		this.registerView(
			VIEW_TYPE_EXAMPLE,
			(leaf) => new ExampleView(leaf)
		);
		
		// Register quiz view
		this.registerView(
			VIEW_TYPE_QUIZ,
			(leaf) => new QuizView(leaf)
		);

		// Add ribbon icon for summaries
		this.addRibbonIcon('list-ordered', 'Summarize Notes', () => {
			this.summarizeNotes();
		});
		
		// Add ribbon icon for quiz
		this.addRibbonIcon('graduation-cap', 'Create Quiz', () => {
			this.createQuizFromCurrentNote();
		});
		
		// Add command for quiz
		this.addCommand({
			id: 'create-quiz-from-current-note',
			name: 'Create Quiz from Current Note',
			checkCallback: (checking: boolean) => {
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (activeView) {
					if (!checking) {
						this.createQuizFromCurrentNote();
					}
					return true;
				}
				return false;
			}
		});

		// Add settings tab
		this.addSettingTab(new LearnSettingTab(this.app, this));
		
		this.ensureDbFolderExists();
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
	
	async ensureDbFolderExists() {
		const dbFolderPath = this.settings.dbFolderPath;
		const folderExists = await this.app.vault.adapter.exists(dbFolderPath);
		
		if (!folderExists) {
			try {
				await this.app.vault.createFolder(dbFolderPath);
				console.log(`Created database folder at ${dbFolderPath}`);
			} catch (error) {
				console.error(`Failed to create database folder: ${error}`);
				new Notice('Failed to create the database folder. Check console for details.');
			}
		}
	}
	
	async checkAndEnsureNoteUuid(file: TFile): Promise<string> {
		const content = await this.app.vault.read(file);
		
		// Check if the note already has a UUID
		const uuidRegex = /^uuid: ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/m;
		const match = content.match(uuidRegex);
		
		if (match && match[1]) {
			// UUID found, return it
			return match[1];
		} else {
			const uuid = uuidv4();
			
			// Check if the note has YAML frontmatter
			const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
			const hasFrontmatter = frontmatterRegex.test(content);
			
			let newContent;
			if (hasFrontmatter) {
				// Add UUID to existing frontmatter
				newContent = content.replace(/^---\n/, `---\nuuid: ${uuid}\n`);
			} else {
				// Create new frontmatter with UUID
				newContent = `---\nuuid: ${uuid}\n---\n\n${content}`;
			}
			
			// Write the updated content back to the file
			await this.app.vault.modify(file, newContent);
			new Notice(`Added UUID to note: ${file.basename}`);
			
			return uuid;
		}
	}
	
	getJsonFilePath(uuid: string): string {
		return `${this.settings.dbFolderPath}/${uuid}.json`;
	}
	
	async getOrCreateNoteData(file: TFile, uuid: string): Promise<NoteData> {
		const jsonPath = this.getJsonFilePath(uuid);
		const exists = await this.app.vault.adapter.exists(jsonPath);
		
		if (exists) {
			// Read existing data
			const jsonContent = await this.app.vault.adapter.read(jsonPath);
			return JSON.parse(jsonContent) as NoteData;
		} else {
			// Create new data structure
			const newNoteData: NoteData = {
				uuid: uuid,
				notePath: file.path,
				lastUpdated: Date.now(),
				distilledContent: {
					facts: [],
					definitions: [],
					quotes: [],
					keyPoints: []
				},
				quizData: []
			};
			
			// Save the new data
			await this.saveNoteData(newNoteData);
			return newNoteData;
		}
	}
	
	async saveNoteData(noteData: NoteData): Promise<void> {
		const jsonPath = this.getJsonFilePath(noteData.uuid);
		await this.app.vault.adapter.write(jsonPath, JSON.stringify(noteData, null, 2));
	}
	
	async distillNoteContent(file: TFile, noteData: NoteData): Promise<NoteData> {
		// Read file content
		const content = await this.app.vault.read(file);
		
		// Build a prompt for the AI to distill the note content
		const prompt = `You are an expert educator creating study materials from student notes. 
						Analyze the following note and extract the following information:
						
						1. Facts: Extract factual statements
						2. Definitions: Extract terms and their definitions
						3. Quotes: Extract any quoted material
						4. Key Points: Extract main ideas and important concepts
						
						Return the result as a valid JSON object with this structure:
						
						{
							"facts": ["Fact 1", "Fact 2", ...],
							"definitions": [
								{ "term": "Term 1", "definition": "Definition 1" },
								{ "term": "Term 2", "definition": "Definition 2" },
								...
							],
							"quotes": ["Quote 1", "Quote 2", ...],
							"keyPoints": ["Key point 1", "Key point 2", ...]
						}
						
						NOTE CONTENT:
						<note>${content}</note>
						
						Important: Return ONLY the JSON with no additional text or markdown formatting.`;
		
		try {
			// Call the LM Studio API
			const result = await callLMStudioAPI(prompt);
			//console.log(`result: ${result}`)
			
			// Clean and parse the JSON result
			const cleanedResult = cleanJsonResponse(result);
			const distilledContent = JSON.parse(cleanedResult);
			
			// Update noteData with the distilled content
			noteData.distilledContent = distilledContent;
			noteData.lastUpdated = Date.now();
			
			// Save the updated data
			await this.saveNoteData(noteData);
			
			return noteData;
		} catch (error) {
			console.error(`Failed to distill note content for ${file.basename}:`, error);
			new Notice(`Failed to distill note content - API error`);
			
			return noteData; // Return unchanged noteData
		}
	}
	
	async createQuizFromNoteData(noteData: NoteData): Promise<Question[]> {
		const { facts, definitions, quotes, keyPoints } = noteData.distilledContent;
		
		// Build a prompt for the AI to generate quiz questions from the distilled content
		const prompt = `You are an expert educator creating quizzes from distilled note content.
						Generate 3-5 questions based on the following distilled content using ONLY the following question formats:
						
						1. Flashcard (question-answer pairs)
						2. Cloze (fill-in-the-blank)
						3. Multiple choice (with 4 options)
						
						Return ONLY a valid JSON array of question objects using these exact formats:
						
						[
						{
							"type": "flashcard",
							"id": 1,
							"question": "What is the capital of France?",
							"answer": "Paris"
						},
						{
							"type": "cloze",
							"id": 2,
							"text": "The capital of France is <CLOZE>.",
							"answer": "Paris"
						},
						{
							"type": "multiple_choice",
							"id": 3,
							"question": "What is the largest planet in our solar system?",
							"options": ["Earth", "Saturn", "Jupiter", "Mars"],
							"correct_index": 2
						}
						]
						
						IMPORTANT FORMATTING:
						- For cloze questions, always use <CLOZE> tag to mark the deleted word(s)
						- Make all questions relevant to the content provided
						
						DISTILLED CONTENT:
						
						Facts:
						${facts.join('\n')}
						
						Definitions:
						${definitions.map(d => `${d.term}: ${d.definition}`).join('\n')}
						
						Quotes:
						${quotes.join('\n')}
						
						Key Points:
						${keyPoints.join('\n')}
						
						Important: Return ONLY the JSON array with no additional text or markdown formatting.`;
		
		try {
			// Call the LM Studio API
			const result = await callLMStudioAPI(prompt);
			
			// Clean and parse the JSON result
			const cleanedResult = cleanJsonResponse(result);
			const quizData = JSON.parse(cleanedResult) as Question[];
			
			// Update noteData with the quiz data
			noteData.quizData = quizData;
			noteData.lastUpdated = Date.now();
			
			// Save the updated data
			await this.saveNoteData(noteData);
			
			return quizData;
		} catch (error) {
			console.error(`Failed to generate quiz questions:`, error);
			new Notice(`Failed to generate quiz questions - API error`);
			
			return [];
		}
	}
	
	async createQuizFromCurrentNote() {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) {
			new Notice('No active note to create quiz from');
			return;
		}

		const file = activeView.file;
		if (!file) {
			new Notice('No file associated with the current view');
			return;
		}
		
		this.currentQuizFile = file;
		new Notice(`Processing ${file.basename}...`);
		
		try {
			// 1. Check for UUID and add if needed
			const uuid = await this.checkAndEnsureNoteUuid(file);
			
			// 2. Get or create associated JSON file
			let noteData = await this.getOrCreateNoteData(file, uuid);
			
			// 3. Check if content needs to be distilled
			const hasDistilledContent = 
				noteData.distilledContent &&
				(noteData.distilledContent.facts.length > 0 ||
				 noteData.distilledContent.keyPoints.length > 0 ||
				 noteData.distilledContent.definitions.length > 0 ||
				 noteData.distilledContent.quotes.length > 0);
			
			const noteHasChanged = await this.hasNoteChanged(file, noteData);
			const shouldRedistill = !hasDistilledContent || noteHasChanged || this.settings.alwaysRedistill;
			
			if (shouldRedistill) {
				let reason = "unknown reason";
				if (!hasDistilledContent) reason = "no existing content";
				else if (noteHasChanged) reason = "note content has changed";
				else if (this.settings.alwaysRedistill) reason = "forced by settings";
				
				new Notice(`Distilling content for ${file.basename} (${reason})...`);
				noteData = await this.distillNoteContent(file, noteData);
			} else {
				new Notice(`Using existing distilled content for ${file.basename}`);
			}
			
			// 4. Generate quiz questions from the distilled content
			new Notice(`Generating quiz questions for ${file.basename}...`);
			const questions = await this.createQuizFromNoteData(noteData);
			
			// 5. Activate the quiz view with the questions
			if (questions && questions.length > 0) {
				await this.activateQuizView(questions);
				new Notice(`Quiz with ${questions.length} questions created for ${file.basename}`);
			} else {
				new Notice('Failed to generate quiz questions');
			}
		} catch (error) {
			console.error(`Failed to process ${file.basename}:`, error);
			new Notice(`Failed to process note - error`);
		}
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
			const prompt = `You are an expert educator creating study materials from student notes. Generate 3-5 questions based on these notes using ONLY the following question formats:

							1. Flashcard (question-answer pairs)
							2. Cloze (fill-in-the-blank)
							3. Multiple choice (with 4 options)

							Return ONLY a valid JSON array of question objects using these exact formats:

							[
							{
								"type": "flashcard",
								"id": 1,
								"question": "What is the capital of France?",
								"answer": "Paris"
							},
							{
								"type": "cloze",
								"id": 2,
								"text": "The capital of France is <CLOZE>.",
								"answer": "Paris"
							},
							{
								"type": "multiple_choice",
								"id": 3,
								"question": "What is the largest planet in our solar system?",
								"options": ["Earth", "Saturn", "Jupiter", "Mars"],
								"correct_index": 2
							}
							]

							IMPORTANT FORMATTING:
							- For cloze questions, always use <CLOZE> tag to mark the deleted word(s), not underscores or blanks
							- Make all questions relevant to the content provided

							NOTES TO PROCESS:
							<notes>${content}</notes>

							Important: Return ONLY the JSON array with no additional text, explanations, or markdown formatting. Do not wrap the JSON in code blocks.`;
			
			// Call the LM Studio API with the note content
			const result = await callLMStudioAPI(prompt);
			console.log(`Raw key points for ${file.basename}:`, result);
			
			// Clean the result for display
			try {
				const cleanedResult = cleanJsonResponse(result);
				return cleanedResult;
			} catch (error) {
				console.error(`Failed to clean JSON for ${file.basename}:`, error);
				return result; // Return the original result if cleaning fails
			}
		} catch (error) {
			console.error(`Failed to extract key points for ${file.basename}:`, error);
			return "Failed to extract key points - API error";
		}
	}
	
	async activateQuizView(questions: Question[]) {
		const { workspace } = this.app;
		
		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_QUIZ);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({
					type: VIEW_TYPE_QUIZ,
					active: true
				});
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
			
			// Pass quiz questions to the view
			const view = leaf.view as QuizView;
			view.setQuestions(questions);
			
			// Set the refresh callback to force re-distillation
			view.setRefreshCallback(() => {
				if (this.currentQuizFile) {
					// Force re-distillation by temporarily enabling alwaysRedistill
					const originalSetting = this.settings.alwaysRedistill;
					this.settings.alwaysRedistill = true;
					
					// Create the quiz again (which will force re-distillation)
					this.createQuizFromCurrentNote();
					
					// Restore the original setting
					this.settings.alwaysRedistill = originalSetting;
				}
			});
			
			const filename = this.currentQuizFile ? this.currentQuizFile.basename : '';
			new Notice(`Quiz with ${questions.length} questions created for ${filename}`);
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

	async hasNoteChanged(file: TFile, noteData: NoteData): Promise<boolean> {
		// Get the last modified time of the file
		const fileModified = file.stat.mtime;
		
		// If the note data's lastUpdated timestamp is older than the file's
		// last modified time, the content has likely changed
		return fileModified > noteData.lastUpdated;
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
				
		new Setting(containerEl)
			.setName('Database Folder Path')
			.setDesc('Path to the folder where note data will be stored (relative to vault root)')
			.addText(text => text
				.setValue(this.plugin.settings.dbFolderPath)
				.onChange(async (value) => {
					this.plugin.settings.dbFolderPath = value;
					await this.plugin.saveSettings();
					
					// Ensure the folder exists after changing the path
					await this.plugin.ensureDbFolderExists();
				}));
				
		new Setting(containerEl)
			.setName('Always Re-distill Content')
			.setDesc('Always re-distill note content even if there are no changes detected')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.alwaysRedistill)
				.onChange(async (value) => {
					this.plugin.settings.alwaysRedistill = value;
					await this.plugin.saveSettings();
				}));
	}
}
