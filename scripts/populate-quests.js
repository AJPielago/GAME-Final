const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Quest = require('../models/Quest');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/codequest', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const sampleQuests = [
  {
    title: "JavaScript Basics",
    description: "Learn the fundamentals of JavaScript programming",
    difficulty: "beginner",
    category: "javascript",
    order: 1,
    questions: [
      {
        question: "What is the correct way to declare a variable in JavaScript?",
        options: ["var myVar;", "variable myVar;", "v myVar;", "declare myVar;"],
        correctAnswer: 0,
        explanation: "The 'var' keyword is used to declare variables in JavaScript."
      },
      {
        question: "Which of the following is NOT a JavaScript data type?",
        options: ["String", "Boolean", "Integer", "Number"],
        correctAnswer: 2,
        explanation: "JavaScript doesn't have an 'Integer' type. It uses 'Number' for all numeric values."
      },
      {
        question: "How do you write a comment in JavaScript?",
        options: ["<!-- This is a comment -->", "// This is a comment", "# This is a comment", "/* This is a comment"],
        correctAnswer: 1,
        explanation: "Single-line comments in JavaScript start with '//'."
      }
    ],
    rewards: {
      experience: 15,
      coins: 10,
      badges: ["first_quest"]
    },
    estimatedTime: 5
  },
  {
    title: "Functions and Scope",
    description: "Master JavaScript functions and understand variable scope",
    difficulty: "beginner",
    category: "javascript",
    order: 2,
    questions: [
      {
        question: "How do you define a function in JavaScript?",
        options: ["function myFunction() {}", "def myFunction():", "function = myFunction() {}", "create myFunction() {}"],
        correctAnswer: 0,
        explanation: "Functions in JavaScript are defined using the 'function' keyword."
      },
      {
        question: "What will 'console.log(x)' output if 'var x = 5;' is declared inside a function?",
        options: ["5", "undefined", "Error", "null"],
        correctAnswer: 2,
        explanation: "Variables declared inside a function are not accessible from outside the function."
      }
    ],
    rewards: {
      experience: 20,
      coins: 15,
      badges: ["function_master"]
    },
    estimatedTime: 8
  },
  {
    title: "Arrays and Objects",
    description: "Work with JavaScript arrays and objects",
    difficulty: "intermediate",
    category: "javascript",
    order: 3,
    questions: [
      {
        question: "How do you add an element to the end of an array?",
        options: ["array.add(element)", "array.push(element)", "array.append(element)", "array.insert(element)"],
        correctAnswer: 1,
        explanation: "The push() method adds elements to the end of an array."
      },
      {
        question: "How do you access a property of an object?",
        options: ["object->property", "object.property", "object[property]", "Both B and C"],
        correctAnswer: 3,
        explanation: "You can access object properties using dot notation (object.property) or bracket notation (object['property'])."
      }
    ],
    rewards: {
      experience: 25,
      coins: 20,
      badges: ["array_navigator", "object_explorer"]
    },
    estimatedTime: 10
  },
  {
    title: "DOM Manipulation",
    description: "Learn to interact with HTML elements using JavaScript",
    difficulty: "intermediate",
    category: "frontend",
    order: 4,
    questions: [
      {
        question: "Which method is used to select an element by its ID?",
        options: ["document.querySelector()", "document.getElementById()", "document.getElement()", "document.selectById()"],
        correctAnswer: 1,
        explanation: "document.getElementById() is the specific method for selecting elements by their ID attribute."
      },
      {
        question: "How do you change the text content of an element?",
        options: ["element.text = 'new text'", "element.innerHTML = 'new text'", "element.textContent = 'new text'", "element.content = 'new text'"],
        correctAnswer: 2,
        explanation: "textContent is the property used to change the text content of an element."
      }
    ],
    rewards: {
      experience: 30,
      coins: 25,
      badges: ["dom_wizard"]
    },
    estimatedTime: 12
  },
  {
    title: "Async Programming",
    description: "Understanding Promises and async/await",
    difficulty: "advanced",
    category: "javascript",
    order: 5,
    questions: [
      {
        question: "What does the 'await' keyword do?",
        options: ["Waits for a Promise to resolve", "Creates a new Promise", "Catches errors", "Starts an async function"],
        correctAnswer: 0,
        explanation: "The 'await' keyword pauses the execution of an async function until a Promise resolves."
      },
      {
        question: "Which is the correct way to handle errors in async/await?",
        options: ["try/catch block", ".catch() method", "error callback", "All of the above"],
        correctAnswer: 0,
        explanation: "In async/await, errors are typically handled using try/catch blocks."
      }
    ],
    rewards: {
      experience: 40,
      coins: 35,
      badges: ["async_adventurer", "js_champion"]
    },
    estimatedTime: 15
  }
];

async function populateQuests() {
  try {
    console.log('🌱 Starting quest population...');
    
    // Clear existing quests
    await Quest.deleteMany({});
    console.log('🗑️ Cleared existing quests');
    
    // Insert sample quests
    const insertedQuests = await Quest.insertMany(sampleQuests);
    console.log(`✅ Inserted ${insertedQuests.length} quests`);
    
    // Display inserted quests
    insertedQuests.forEach((quest, index) => {
      console.log(`${index + 1}. ${quest.title} (${quest.difficulty}) - ${quest.questions.length} questions`);
    });
    
    console.log('🎉 Quest population completed successfully!');
    
  } catch (error) {
    console.error('❌ Error populating quests:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the population script
populateQuests();
