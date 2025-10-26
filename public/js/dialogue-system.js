// Dialogue System for Quest NPCs
// Handles multi-part educational dialogues with visual interface

// Multi-part dialogue state
let questDialogue = {
  active: false,
  currentPart: 0,
  parts: [],
  questId: '',
  title: '',
  npcImage: null
};

// Quest dialogue data with educational content
const questDialogues = {
  'quest2': {
    title: 'JavaScript History Lesson',
    npcImage: '/images/Q2.jpg', // NPC image for this quest
    parts: [
      "Welcome, young coder! Ready to learn about JavaScript's fascinating history?",
      "JavaScript was created in 1995 by Brendan Eich at Netscape Communications.",
      "It was originally called 'Mocha', then renamed to 'LiveScript', and finally 'JavaScript'.",
      "Despite its name, JavaScript has no relation to Java programming language!",
      "The name was chosen purely for marketing reasons when Java was popular.",
      "JavaScript became the standard for web browsers and is now one of the most popular languages.",
      "Today, JavaScript powers websites, mobile apps, servers, and even desktop applications!",
      "You've completed the JavaScript History lesson! Press Enter to finish."
    ]
  },
  'quest 8': {
    title: 'Variables & Data Types',
    npcImage: '/images/Q8.jpg',
    parts: [
      "Greetings! Let me teach you about variables and data types in JavaScript.",
      "Variables are containers for storing data values. Think of them as labeled boxes!",
      "In JavaScript, we use 'let', 'const', or 'var' to declare variables.",
      "let name = 'Alex'; // A string variable",
      "const age = 25; // A number that won't change",
      "JavaScript has several data types: String, Number, Boolean, Object, Array, and more!",
      "let isStudent = true; // Boolean (true or false)",
      "Understanding data types is fundamental to programming. Great job!",
      "Quest complete! You've learned about variables and data types."
    ]
  },
  'quest 9': {
    title: 'Functions & Scope',
    npcImage: '/images/Q9.jpg',
    parts: [
      "Welcome! Today we'll explore functions - the building blocks of code.",
      "Functions are reusable blocks of code that perform specific tasks.",
      "function greet(name) { return 'Hello, ' + name; }",
      "You can call a function like this: greet('World'); // Returns 'Hello, World'",
      "Scope determines where variables can be accessed in your code.",
      "Variables declared inside a function are 'local' and can't be accessed outside.",
      "Variables declared outside are 'global' and accessible everywhere.",
      "Arrow functions are a modern way: const add = (a, b) => a + b;",
      "Excellent! You now understand functions and scope!"
    ]
  },
  'quest 10': {
    title: 'Arrays & Objects',
    npcImage: '/images/Q10.jpg',
    parts: [
      "Hello, adventurer! Let's dive into arrays and objects.",
      "Arrays store multiple values in a single variable: let fruits = ['apple', 'banana', 'orange'];",
      "Access array items by index: fruits[0] // Returns 'apple'",
      "Arrays have useful methods: push(), pop(), map(), filter(), and more!",
      "Objects store data as key-value pairs: let person = { name: 'Alex', age: 25 };",
      "Access object properties: person.name // Returns 'Alex'",
      "You can nest arrays and objects to create complex data structures.",
      "Arrays and objects are essential for organizing data in your programs.",
      "Well done! You've mastered arrays and objects!"
    ]
  },
  'quest 11': {
    title: 'Loops & Iteration',
    npcImage: '/images/Q11.jpg',
    parts: [
      "Greetings, coder! Time to learn about loops and iteration.",
      "Loops let you repeat code multiple times without writing it over and over.",
      "for (let i = 0; i < 5; i++) { console.log(i); } // Prints 0 to 4",
      "While loops continue until a condition is false: while (x < 10) { x++; }",
      "forEach is great for arrays: fruits.forEach(fruit => console.log(fruit));",
      "The 'break' keyword exits a loop early, 'continue' skips to the next iteration.",
      "Loops are powerful but be careful of infinite loops - they never stop!",
      "Use loops to process data, repeat actions, and solve complex problems.",
      "Congratulations! You've completed the loops lesson!"
    ]
  }
};

// Quest dialogue functions
function startQuestDialogue(questId) {
  const dialogue = questDialogues[questId];
  if (dialogue) {
    questDialogue.active = true;
    questDialogue.currentPart = 0;
    questDialogue.parts = dialogue.parts;
    questDialogue.questId = questId;
    questDialogue.title = dialogue.title;
    
    // Load NPC image if specified
    if (dialogue.npcImage) {
      questDialogue.npcImage = new Image();
      questDialogue.npcImage.onload = function() {
        console.log('✅ NPC image loaded:', dialogue.npcImage);
      };
      questDialogue.npcImage.onerror = function() {
        console.error('❌ Failed to load NPC image:', dialogue.npcImage);
        questDialogue.npcImage = null;
      };
      questDialogue.npcImage.src = dialogue.npcImage;
      console.log('🖼️ Loading NPC image:', dialogue.npcImage);
    }
    
    console.log(`📚 Started quest dialogue: ${dialogue.title}`);
  }
}

function nextDialoguePart() {
  if (questDialogue.active) {
    questDialogue.currentPart++;
    if (questDialogue.currentPart >= questDialogue.parts.length) {
      // Dialogue finished
      questDialogue.active = false;
      questDialogue.npcImage = null; // Clear image
      console.log(`✅ Completed quest dialogue: ${questDialogue.title}`);
      
      // Trigger quest completion callback if available
      if (typeof window.onQuestComplete === 'function') {
        window.onQuestComplete(questDialogue.questId, questDialogue.title);
      }
    }
  }
}

// Check if quest dialogue is active (for keyboard handling)
function isQuestDialogueActive() {
  return questDialogue.active;
}

// Handle quest dialogue keyboard input
function handleQuestDialogueInput(key) {
  if (questDialogue.active && key === 'Enter') {
    nextDialoguePart();
    return true; // Handled
  }
  return false; // Not handled
}

// Check if object should trigger quest dialogue
function shouldStartQuestDialogue(obj) {
  if (!obj || !obj.name) return false;
  const questName = obj.name.toLowerCase();
  return questName.includes('quest') && questDialogues[questName];
}

// Get quest name from object
function getQuestName(obj) {
  if (!obj || !obj.name) return null;
  return obj.name.toLowerCase();
}

// Draw quest dialogue interface
function drawQuestDialogue(ctx, canvas) {
  if (!questDialogue.active) return;
  
  // Semi-transparent overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Dialog box dimensions - positioned higher and smaller for better visibility
  const dialogWidth = Math.min(600, canvas.width - 40);
  const dialogHeight = 180;
  const dialogX = (canvas.width - dialogWidth) / 2;
  const dialogY = canvas.height - dialogHeight - 100; // Even more margin from bottom
  
  // NPC image area (left side) - smaller to fit in reduced dialogue box
  const imageSize = 80;
  const imageX = dialogX + 15;
  const imageY = dialogY + 35;
  
  // Text area (right side)
  const textX = imageX + imageSize + 20;
  const textWidth = dialogWidth - imageSize - 60;
  
  // Background
  ctx.fillStyle = 'rgba(20, 30, 50, 0.95)';
  ctx.fillRect(dialogX, dialogY, dialogWidth, dialogHeight);
  
  // Border
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 3;
  ctx.strokeRect(dialogX, dialogY, dialogWidth, dialogHeight);
  
  // Title
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(questDialogue.title, dialogX + dialogWidth/2, dialogY + 25);
  
  // Progress indicator
  const progress = `${questDialogue.currentPart + 1} / ${questDialogue.parts.length}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = '12px Arial';
  ctx.textAlign = 'right';
  ctx.fillText(progress, dialogX + dialogWidth - 15, dialogY + 25);
  
  // Draw NPC image if loaded
  if (questDialogue.npcImage && questDialogue.npcImage.complete) {
    // Image background
    ctx.fillStyle = 'rgba(40, 50, 70, 0.8)';
    ctx.fillRect(imageX - 5, imageY - 5, imageSize + 10, imageSize + 10);
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.strokeRect(imageX - 5, imageY - 5, imageSize + 10, imageSize + 10);
    
    // Draw the NPC image
    ctx.drawImage(questDialogue.npcImage, imageX, imageY, imageSize, imageSize);
  } else {
    // Placeholder if image not loaded
    ctx.fillStyle = 'rgba(40, 50, 70, 0.8)';
    ctx.fillRect(imageX, imageY, imageSize, imageSize);
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.strokeRect(imageX, imageY, imageSize, imageSize);
    
    // NPC placeholder text
    ctx.fillStyle = '#FFD700';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('NPC', imageX + imageSize/2, imageY + imageSize/2);
  }
  
  // Current dialogue text
  const currentText = questDialogue.parts[questDialogue.currentPart] || 'No dialogue text available';
  
  
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px Arial'; // Smaller font for better fit
  ctx.textAlign = 'left';
  
  // Word wrap the text in the text area
  const words = currentText.split(' ');
  let line = '';
  let y = dialogY + 50; // Start higher
  const lineHeight = 18; // Tighter line spacing
  
  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    
    if (testWidth > textWidth && i > 0) {
      ctx.fillText(line, textX, y);
      line = words[i] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, textX, y);
  
  
  // Instructions
  ctx.fillStyle = 'rgba(255, 215, 0, 0.8)';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  const isLastPart = questDialogue.currentPart >= questDialogue.parts.length - 1;
  const instruction = isLastPart ? 'Press Enter to complete' : 'Press Enter to continue';
  ctx.fillText(instruction, dialogX + dialogWidth/2, dialogY + dialogHeight - 15);
}

// Export functions for use in main game file
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    startQuestDialogue,
    nextDialoguePart,
    isQuestDialogueActive,
    handleQuestDialogueInput,
    shouldStartQuestDialogue,
    getQuestName,
    drawQuestDialogue,
    questDialogue
  };
}
