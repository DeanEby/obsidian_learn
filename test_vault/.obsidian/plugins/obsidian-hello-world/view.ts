import { ItemView, WorkspaceLeaf, TFile } from "obsidian";

export const VIEW_TYPE_EXAMPLE = 'example-view';

export class ExampleView extends ItemView 
{
  private files: TFile[] = [];
  
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
    return 'Example view';
  }

  updateFiles(files: TFile[]) {
    this.files = files;
    this.refresh();
  }

  refresh() {
    this.onOpen();
  }

  async onOpen() 
  {
    const container = this.containerEl.children[1];
    container.empty();
    
    container.createEl('h2', { text: 'Markdown Files in Vault' });
    
    if (this.files && this.files.length > 0) {
      const listEl = container.createEl('ul');
      
      for (const file of this.files) {
        const item = listEl.createEl('li');
        const link = item.createEl('a', { 
          text: file.path,
          href: file.path
        });
        
        link.addEventListener('click', (event) => {
          event.preventDefault();
          this.app.workspace.getLeaf().openFile(file);
        });
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