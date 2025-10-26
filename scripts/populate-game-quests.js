const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Quest = require('../models/Quest');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/codequest', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const gameQuests = [
  {
    title: "Welcome to CodeQuest",
    description: "Enter your adventurer name and begin your coding journey",
    difficulty: "beginner",
    category: "general",
    questType: "interactive",
    order: 1,
    lesson: {
      title: "Welcome, New Adventurer!",
      content: "Welcome to CodeQuest, where coding meets adventure! Every great journey begins with a name. What shall we call you on this epic quest to master programming?",
      keyPoints: [
        "Your name will be your identity in the coding world",
        "Choose something that represents your coding aspirations",
        "You can always change it later in your profile"
      ],
      isInteractive: true
    },
    questions: [
      {
        question: "What would you like to be called in CodeQuest?",
        options: ["Enter your name below", "Skip for now", "Use default name", "I'll decide later"],
        correctAnswer: 0,
        explanation: "Perfect! Your adventure begins now. Remember, every expert was once a beginner."
      }
    ],
    rewards: {
      experience: 10,
      coins: 5,
      badges: ["first_quest", "adventurer_name"]
    },
    estimatedTime: 2
  },
  {
    title: "The History of JavaScript",
    description: "Learn about the origins and evolution of JavaScript",
    difficulty: "beginner", 
    category: "javascript",
    questType: "lesson",
    order: 2,
    lesson: {
      title: "The Birth of JavaScript",
      content: "In 1995, a programmer named Brendan Eich created JavaScript in just 10 days while working at Netscape. Originally called 'Mocha', then 'LiveScript', it was finally renamed 'JavaScript' to ride the wave of Java's popularity. Despite the name similarity, JavaScript and Java are completely different languages!\n\nJavaScript was created to make web pages interactive. Before JavaScript, websites were just static documents. With JavaScript, developers could create dynamic content, respond to user actions, and build the interactive web we know today.\n\nToday, JavaScript runs not just in browsers, but on servers (Node.js), mobile apps, desktop applications, and even IoT devices. It has become one of the most popular programming languages in the world!",
      examples: [
        "// Your first JavaScript code\nconsole.log('Hello, CodeQuest!');",
        "// Making web pages interactive\ndocument.getElementById('button').onclick = function() {\n    alert('Welcome to JavaScript!');\n};"
      ],
      keyPoints: [
        "JavaScript was created by Brendan Eich in 1995",
        "It was originally called 'Mocha', then 'LiveScript'",
        "JavaScript and Java are completely different languages",
        "JavaScript makes web pages interactive and dynamic",
        "Today, JavaScript runs everywhere - browsers, servers, mobile apps"
      ],
      isInteractive: false
    },
    questions: [
      {
        question: "Who created JavaScript?",
        options: ["Brendan Eich", "James Gosling", "Guido van Rossum", "Dennis Ritchie"],
        correctAnswer: 0,
        explanation: "Correct! Brendan Eich created JavaScript in 1995 while working at Netscape."
      },
      {
        question: "What was JavaScript originally called?",
        options: ["LiveScript", "Mocha", "Both Mocha and LiveScript", "WebScript"],
        correctAnswer: 2,
        explanation: "JavaScript was first called 'Mocha', then renamed to 'LiveScript', and finally became 'JavaScript'."
      },
      {
        question: "How long did it take to create the first version of JavaScript?",
        options: ["1 month", "6 months", "10 days", "1 year"],
        correctAnswer: 2,
        explanation: "Amazing but true! Brendan Eich created the first version of JavaScript in just 10 days."
      }
    ],
    rewards: {
      experience: 25,
      coins: 15,
      badges: ["history_buff", "js_foundation"]
    },
    estimatedTime: 8
  },
  {
    title: "JavaScript Fundamentals",
    description: "Learn the basic building blocks of JavaScript programming",
    difficulty: "beginner",
    category: "javascript", 
    questType: "lesson",
    order: 3,
    lesson: {
      title: "JavaScript Building Blocks",
      content: "Now that you know JavaScript's history, let's learn how to actually use it! JavaScript is built on a few fundamental concepts that you'll use in every program you write.\n\nFirst, we have variables - containers that store data. Think of them like labeled boxes where you can put different types of information.\n\nNext, we have data types - different kinds of information JavaScript can work with: numbers, text (strings), true/false values (booleans), and more.\n\nFinally, we have functions - reusable blocks of code that perform specific tasks. Functions are like recipes - you write them once and can use them many times!",
      examples: [
        "// Variables store data\nlet playerName = 'CodeWarrior';\nlet playerLevel = 1;\nlet hasWeapon = true;",
        "// Functions perform tasks\nfunction levelUp() {\n    playerLevel = playerLevel + 1;\n    console.log('Level up! Now level ' + playerLevel);\n}",
        "// Using the function\nlevelUp(); // Outputs: Level up! Now level 2"
      ],
      keyPoints: [
        "Variables store data using 'let', 'const', or 'var'",
        "JavaScript has different data types: strings, numbers, booleans",
        "Functions are reusable blocks of code",
        "Use console.log() to display information",
        "JavaScript is case-sensitive"
      ],
      isInteractive: false
    },
    questions: [
      {
        question: "Which keyword is used to declare a variable in modern JavaScript?",
        options: ["var", "let", "const", "Both let and const"],
        correctAnswer: 3,
        explanation: "Both 'let' and 'const' are modern ways to declare variables. Use 'let' for values that change, 'const' for values that stay the same."
      },
      {
        question: "What data type is 'Hello World'?",
        options: ["Number", "String", "Boolean", "Function"],
        correctAnswer: 1,
        explanation: "Text enclosed in quotes is called a 'string' in JavaScript."
      },
      {
        question: "What does console.log() do?",
        options: ["Creates a variable", "Displays information", "Defines a function", "Deletes data"],
        correctAnswer: 1,
        explanation: "console.log() displays information in the browser's console - very useful for debugging!"
      }
    ],
    rewards: {
      experience: 30,
      coins: 20,
      badges: ["syntax_slayer", "variable_master"]
    },
    estimatedTime: 10
  }
];

async function populateGameQuests() {
  try {
    console.log('🎮 Starting game quest population...');
    
    // Clear existing quests
    await Quest.deleteMany({});
    console.log('🗑️ Cleared existing quests');
    
    // Insert game-specific quests
    const insertedQuests = await Quest.insertMany(gameQuests);
    console.log(`✅ Inserted ${insertedQuests.length} game quests`);
    
    // Display inserted quests
    insertedQuests.forEach((quest, index) => {
      console.log(`${index + 1}. ${quest.title} (${quest.questType}) - ${quest.questions.length} questions`);
      console.log(`   Lesson: ${quest.lesson.title}`);
      console.log(`   Rewards: ${quest.rewards.experience} XP, ${quest.rewards.coins} coins`);
      console.log('');
    });
    
    console.log('🎉 Game quest population completed successfully!');
    
  } catch (error) {
    console.error('❌ Error populating game quests:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the population script
populateGameQuests();
