import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, TFile } from 'obsidian';
import { ExampleView, VIEW_TYPE_EXAMPLE } from './view';
import { QuizView, VIEW_TYPE_QUIZ, Question } from './quiz';

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

// Function to clean API response and extract valid JSON
function cleanJsonResponse(response: string): string {
  // Remove markdown code block indicators
  let cleaned = response.trim();
  
  // Remove ```json or ``` from the beginning
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.substring(7).trim();
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.substring(3).trim();
  }
  
  // Remove ``` from the end
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3).trim();
  }
  
  // Remove any other markdown formatting or text outside the JSON
  const jsonStartIndex = cleaned.indexOf('[');
  const jsonEndIndex = cleaned.lastIndexOf(']');
  
  if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
    cleaned = cleaned.substring(jsonStartIndex, jsonEndIndex + 1);
  }
  
  return cleaned;
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
		new Notice(`Generating quiz for ${file.basename}...`);
		
		try {
			// Read file content
			const content = await this.app.vault.read(file);
			
			// Build a prompt for the AI to extract key points and create quiz
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
			console.log(`Raw quiz data for ${file.basename}:`, result);
			
			// Clean and parse the JSON result
			try {
				const cleanedResult = cleanJsonResponse(result);
				console.log(`Cleaned quiz data for ${file.basename}:`, cleanedResult);
				
				const quizData = JSON.parse(cleanedResult) as Question[];
				await this.activateQuizView(quizData);
			} catch (parseError) {
				console.error("Failed to parse quiz data:", parseError);
				new Notice("Failed to parse quiz data from API response");
			}
		} catch (error) {
			console.error(`Failed to generate quiz for ${file.basename}:`, error);
			new Notice(`Failed to generate quiz - API error`);
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
