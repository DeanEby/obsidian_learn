import { ItemView, WorkspaceLeaf, TFile } from "obsidian";

export const VIEW_TYPE_EXAMPLE = 'example-view';

export class ExampleView extends ItemView 
{
  private files: TFile[] = [];
  private summaries: Map<string, string> = new Map();
  
  constructor(leaf: WorkspaceLeaf)
  {
    super(leaf);
  }

  getViewType()
  {
    return VIEW_TYPE_EXAMPLE;
  }

  getDisplayText()
  {
    return 'Note Summaries';
  }

  updateFiles(files: TFile[]) {
    this.files = files;
    this.refresh();
  }

  updateSummaries(summaries: Map<string, string>) {
    this.summaries = summaries;
    this.refresh();
  }

  refresh() {
    this.onOpen();
  }

  async onOpen() 
  {
    const container = this.containerEl.children[1];
    container.empty();
    
    container.createEl('h2', { text: 'Note Summaries' });
    
    if (this.files && this.files.length > 0) {
      const listEl = container.createEl('div', { cls: 'note-list' });
      
      for (const file of this.files) {
        const item = listEl.createEl('div', { cls: 'note-item' });
        
        // Create header with file name
        const header = item.createEl('div', { cls: 'note-header' });
        const link = header.createEl('a', { 
          text: file.basename,
          href: file.path,
          cls: 'note-link'
        });
        
        link.addEventListener('click', (event) => {
          event.preventDefault();
          this.app.workspace.getLeaf().openFile(file);
        });
        
        // Add summary if available
        if (this.summaries.has(file.path)) {
          const summaryEl = item.createEl('div', { 
            cls: 'note-summary',
            text: this.summaries.get(file.path)
          });
        }
      }
    } else {
      container.createEl('p', { text: 'No markdown files found in the vault.' });
    }
  }

  async onClose() {
    // Clean up
    this.containerEl.empty();
  }
}