import { ItemView, WorkspaceLeaf } from "obsidian";

export const VIEW_TYPE_QUIZ = "quiz-view";

// Define types for quiz questions
export interface QuizQuestion {
  id: number;
  type: string;
}

export interface FlashcardQuestion extends QuizQuestion {
  type: "flashcard";
  question: string;
  answer: string;
}

export interface ClozeQuestion extends QuizQuestion {
  type: "cloze";
  text: string;
  answer: string;
}

export interface MultipleChoiceQuestion extends QuizQuestion {
  type: "multiple_choice";
  question: string;
  options: string[];
  correct_index: number;
}

export type Question = FlashcardQuestion | ClozeQuestion | MultipleChoiceQuestion;

// Anki-style rating levels
enum Rating {
  AGAIN = 1,
  HARD = 2,
  GOOD = 3,
  EASY = 4
}

export class QuizView extends ItemView {
  private questions: Question[] = [];
  private currentQuestionIndex: number = 0;
  private score: number = 0;
  private userAnswers: Map<number, any> = new Map();
  private userRatings: Map<number, Rating> = new Map();
  private showingAnswer: boolean = false;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_QUIZ;
  }

  getDisplayText(): string {
    return "Quiz";
  }

  setQuestions(questions: Question[]) {
    this.questions = questions;
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.userAnswers.clear();
    this.userRatings.clear();
    this.showingAnswer = false;
    this.refresh();
  }

  refresh() {
    this.onOpen();
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("quiz-container");

    if (this.questions.length === 0) {
      container.createEl("p", { text: "No quiz questions available." });
      return;
    }

    // Create quiz header with progress
    const headerEl = container.createEl("div", { cls: "quiz-header" });
    headerEl.createEl("h2", { text: "Quiz" });
    
    const progressEl = headerEl.createEl("div", { cls: "quiz-progress" });
    progressEl.createEl("span", { 
      text: `Question ${this.currentQuestionIndex + 1} of ${this.questions.length}` 
    });

    // Create quiz content
    const contentEl = container.createEl("div", { cls: "quiz-content" });
    
    // Render current question
    const currentQuestion = this.questions[this.currentQuestionIndex];
    this.renderQuestion(contentEl, currentQuestion);
    
    // Create quiz controls
    const controlsEl = container.createEl("div", { cls: "quiz-controls" });
    
    // Handle controls differently based on question type and state
    if (currentQuestion.type === "multiple_choice") {
      if (this.showingAnswer) {
        // Just show next button for multiple choice after showing answer
        const nextBtn = controlsEl.createEl("button", { text: "Next", cls: "next-button" });
        nextBtn.addEventListener("click", () => {
          this.showingAnswer = false;
          this.goToNextQuestion();
        });
      } else {
        // Check answer button for multiple choice
        const checkBtn = controlsEl.createEl("button", { text: "Check Answer", cls: "check-button" });
        checkBtn.addEventListener("click", () => {
          this.checkMultipleChoiceAnswer(currentQuestion);
        });
      }
    } else {
      // For flashcards and cloze questions
      if (this.showingAnswer) {
        // Show Anki-style rating buttons when answer is revealed
        this.renderRatingButtons(controlsEl, currentQuestion);
      } else {
        // Show answer button for flashcards and cloze
        const showAnswerBtn = controlsEl.createEl("button", { text: "Show Answer", cls: "show-answer-button" });
        showAnswerBtn.addEventListener("click", () => {
          this.showingAnswer = true;
          this.refresh();
        });
      }
    }
  }

  renderRatingButtons(containerEl: HTMLElement, question: Question) {
    const ratingContainer = containerEl.createEl("div", { cls: "rating-buttons" });
    
    // Create Anki-style buttons
    const createRatingButton = (rating: Rating, label: string, cls: string) => {
      const btn = ratingContainer.createEl("button", { text: label, cls: `rating-button ${cls}` });
      btn.addEventListener("click", () => {
        this.userRatings.set(question.id, rating);
        this.showingAnswer = false;
        this.goToNextQuestion();
      });
      return btn;
    };
    
    createRatingButton(Rating.AGAIN, "Again", "rating-again");
    createRatingButton(Rating.HARD, "Hard", "rating-hard");
    createRatingButton(Rating.GOOD, "Good", "rating-good");
    createRatingButton(Rating.EASY, "Easy", "rating-easy");
  }

  renderQuestion(containerEl: HTMLElement, question: Question) {
    switch (question.type) {
      case "flashcard":
        this.renderFlashcard(containerEl, question);
        break;
      case "cloze":
        this.renderCloze(containerEl, question);
        break;
      case "multiple_choice":
        this.renderMultipleChoice(containerEl, question);
        break;
    }
  }

  renderFlashcard(containerEl: HTMLElement, question: FlashcardQuestion) {
    const questionEl = containerEl.createEl("div", { cls: "question flashcard-question" });
    questionEl.createEl("h3", { text: question.question });
    
    if (this.showingAnswer) {
      const answerEl = questionEl.createEl("div", { cls: "answer" });
      answerEl.createEl("p", { text: question.answer });
    } else {
      const inputEl = questionEl.createEl("textarea", { 
        cls: "flashcard-answer",
        attr: { placeholder: "Your answer... (not checked automatically)" }
      });
      
      // If the user already answered, show their answer
      if (this.userAnswers.has(question.id)) {
        inputEl.value = this.userAnswers.get(question.id);
      }
      
      inputEl.addEventListener("input", (e) => {
        const target = e.target as HTMLTextAreaElement;
        this.userAnswers.set(question.id, target.value);
      });
    }
  }

  renderCloze(containerEl: HTMLElement, question: ClozeQuestion) {
    const questionEl = containerEl.createEl("div", { cls: "question cloze-question" });
    
    const clozeText = question.text;
    const parts = clozeText.split("<CLOZE>");
    
    if (this.showingAnswer) {
      const answerEl = questionEl.createEl("div");
      
      const prefix = answerEl.createSpan();
      prefix.innerText = parts[0];
      
      const answerSpan = answerEl.createSpan({ cls: "cloze-answer revealed" });
      answerSpan.innerText = question.answer;
      
      if (parts.length > 1) {
        const suffix = answerEl.createSpan();
        suffix.innerText = parts[1];
      }
    } else {
      const inputContainer = questionEl.createEl("div", { cls: "cloze-container" });
      
      const prefix = inputContainer.createSpan();
      prefix.innerText = parts[0];
      
      const input = inputContainer.createEl("input", { 
        cls: "cloze-input",
        attr: { type: "text", placeholder: "..." }
      });
      
      // If the user already answered, show their answer
      if (this.userAnswers.has(question.id)) {
        input.value = this.userAnswers.get(question.id);
      }
      
      input.addEventListener("input", (e) => {
        const target = e.target as HTMLInputElement;
        this.userAnswers.set(question.id, target.value);
      });
      
      if (parts.length > 1) {
        const suffix = inputContainer.createSpan();
        suffix.innerText = parts[1];
      }
    }
  }

  renderMultipleChoice(containerEl: HTMLElement, question: MultipleChoiceQuestion) {
    const questionEl = containerEl.createEl("div", { cls: "question multiple-choice-question" });
    questionEl.createEl("h3", { text: question.question });
    
    const optionsEl = questionEl.createEl("div", { cls: "options" });
    
    question.options.forEach((option, index) => {
      const optionContainer = optionsEl.createEl("div", { cls: "option-container" });
      
      if (this.showingAnswer) {
        const isSelected = this.userAnswers.get(question.id) === index;
        const isCorrect = index === question.correct_index;
        
        try {
          let classesToAdd: string[] = [];
          
          if (isSelected && isCorrect) {
            classesToAdd.push("selected", "correct");
          } else if (isSelected && !isCorrect) {
            classesToAdd.push("selected", "incorrect");
          } else if (!isSelected && isCorrect) {
            classesToAdd.push("correct");
          }
          
          // Add each class individually to avoid empty string issues
          classesToAdd.forEach(cls => {
            if (cls && cls.trim()) {
              optionContainer.addClass(cls);
            }
          });
        } catch (error) {
          console.error("Error adding classes to option container:", error);
        }
        
        optionContainer.createSpan({ text: option });
      } else {
        const isSelected = this.userAnswers.get(question.id) === index;
        
        // Only add class if selected is true
        if (isSelected) {
          try {
            optionContainer.addClass("selected");
          } catch (error) {
            console.error("Error adding 'selected' class:", error);
          }
        }
        
        optionContainer.createSpan({ text: option });
        
        optionContainer.addEventListener("click", () => {
          this.userAnswers.set(question.id, index);
          this.refresh();
        });
      }
    });
  }

  checkMultipleChoiceAnswer(question: MultipleChoiceQuestion) {
    if (!this.userAnswers.has(question.id)) {
      // If no answer, prompt user
      const container = this.containerEl.children[1];
      const warningEl = container.createEl("div", { cls: "answer-warning" });
      warningEl.createEl("p", { text: "Please select an answer before checking." });
      
      // Remove warning after 2 seconds
      setTimeout(() => {
        warningEl.remove();
      }, 2000);
      
      return;
    }

    const userAnswer = this.userAnswers.get(question.id);
    const isCorrect = userAnswer === question.correct_index;

    
    this.showingAnswer = true;
    console.log("before refresh");
    this.refresh();
  }

  goToNextQuestion() {
    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.currentQuestionIndex++;
    } else {
      // If it's the last question, show results
      this.showResults();
      return;
    }
    
    this.refresh();
  }

  showResults() {
    const container = this.containerEl.children[1];
    container.empty();
    
    const resultsEl = container.createEl("div", { cls: "quiz-results" });
    resultsEl.createEl("h2", { text: "Quiz Results" });
    
    // Count multiple choice correct answers
    let multipleChoiceCorrect = 0;
    let multipleChoiceTotal = 0;
    
    this.questions.forEach(q => {
      if (q.type === "multiple_choice") {
        multipleChoiceTotal++;
        if (this.userAnswers.has(q.id) && 
            this.userAnswers.get(q.id) === (q as MultipleChoiceQuestion).correct_index) {
          multipleChoiceCorrect++;
        }
      }
    });
    
    // Show multiple choice score if there were any such questions
    if (multipleChoiceTotal > 0) {
      const mcScoreEl = resultsEl.createEl("div", { cls: "score" });
      mcScoreEl.createEl("p", { 
        text: `Multiple Choice: ${multipleChoiceCorrect} correct out of ${multipleChoiceTotal}`,
        cls: "score-text" 
      });
      
      const mcPercentage = Math.round((multipleChoiceCorrect / multipleChoiceTotal) * 100);
      mcScoreEl.createEl("p", { 
        text: `${mcPercentage}%`,
        cls: "score-percentage"
      });
    }
    
    // Show a summary of self-rated items
    const selfRatedCount = this.userRatings.size;
    if (selfRatedCount > 0) {
      const ratingsBreakdown = resultsEl.createEl("div", { cls: "ratings-breakdown" });
      ratingsBreakdown.createEl("h3", { text: "Self-Evaluation Ratings" });
      
      const countByRating = new Map<Rating, number>();
      this.userRatings.forEach(rating => {
        countByRating.set(rating, (countByRating.get(rating) || 0) + 1);
      });
      
      const ratingLabels = new Map<Rating, string>([
        [Rating.AGAIN, "Again"],
        [Rating.HARD, "Hard"],
        [Rating.GOOD, "Good"],
        [Rating.EASY, "Easy"]
      ]);
      
      const ratingsList = ratingsBreakdown.createEl("ul", { cls: "ratings-list" });
      
      // Display counts for each rating
      [Rating.AGAIN, Rating.HARD, Rating.GOOD, Rating.EASY].forEach(rating => {
        const count = countByRating.get(rating) || 0;
        if (count > 0) {
          const percentage = Math.round((count / selfRatedCount) * 100);
          ratingsList.createEl("li", { 
            text: `${ratingLabels.get(rating)}: ${count} (${percentage}%)`,
            cls: `rating-${ratingLabels.get(rating)?.toLowerCase()}`
          });
        }
      });
    }
    
    // Add button to restart quiz
    const restartBtn = resultsEl.createEl("button", { text: "Restart Quiz" });
    restartBtn.addEventListener("click", () => {
      this.currentQuestionIndex = 0;
      this.score = 0;
      this.userAnswers.clear();
      this.userRatings.clear();
      this.showingAnswer = false;
      this.refresh();
    });
  }

  async onClose() {
    // Clean up
    this.containerEl.empty();
  }
} 