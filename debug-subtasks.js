require('dotenv').config();
const { TaskRepository } = require('./dist/database');

console.log('🔍 Debugging Subtask Deletion Issue...\n');

// Use the actual user ID from the API response
const userId = '17c08e74-b6e0-4b65-9bfc-234083f7e025';

console.log('Step 1: Checking current tasks for user:', userId);

// Get all tasks for this user
const tasks = TaskRepository.getTasksByUser(userId);
console.log('Total parent tasks found:', tasks.length);

tasks.forEach((task, index) => {
  console.log(`\nTask ${index + 1}:`);
  console.log('  ID:', task.id);
  console.log('  Task:', task.task);
  console.log('  Completed:', task.completed);
  console.log('  IsParent:', task.isParent);
  console.log('  Subtasks:', task.subtasks ? task.subtasks.length : 0);
  
  if (task.subtasks && task.subtasks.length > 0) {
    task.subtasks.forEach((subtask, subIndex) => {
      console.log(`    Subtask ${subIndex + 1}:`, subtask.task, '(completed:', subtask.completed + ')');
    });
  }
});

console.log('\n' + '='.repeat(50));
console.log('Step 2: Checking database directly...');

// Check the database directly with raw SQL
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'data', 'tasks.db');
const db = new Database(DB_PATH);

// Get all tasks for this user from database
console.log('\nRaw database query results:');
const allUserTasks = db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at').all(userId);

console.log('Total tasks in database for user:', allUserTasks.length);

allUserTasks.forEach((row, index) => {
  console.log(`\nDB Row ${index + 1}:`);
  console.log('  ID:', row.id);
  console.log('  Task:', row.task);
  console.log('  Completed:', row.completed);
  console.log('  IsParent:', row.is_parent);
  console.log('  ParentId:', row.parent_id);
  console.log('  UserId:', row.user_id);
});

console.log('\n' + '='.repeat(50));
console.log('Step 3: Checking parent-subtask relationships...');

// Check parent-subtask relationships
const parentTasks = allUserTasks.filter(row => row.is_parent);
console.log('Parent tasks found:', parentTasks.length);

parentTasks.forEach((parent, index) => {
  console.log(`\nParent ${index + 1}: ${parent.task} (ID: ${parent.id})`);
  
  const subtasks = allUserTasks.filter(row => row.parent_id === parent.id);
  console.log('  Subtasks in DB:', subtasks.length);
  
  subtasks.forEach((subtask, subIndex) => {
    console.log(`    Subtask ${subIndex + 1}:`, subtask.task, '(completed:', subtask.completed + ')');
  });
  
  // Test the getUserSubtasksStmt query manually
  const getUserSubtasksStmt = db.prepare(`
    SELECT * FROM tasks WHERE parent_id = ? AND user_id = ? ORDER BY task_order ASC, created_at ASC
  `);
  
  const queryResult = getUserSubtasksStmt.all(parent.id, userId);
  console.log('  Query result subtasks:', queryResult.length);
  
  if (queryResult.length !== subtasks.length) {
    console.log('  �� MISMATCH: Query returned different number of subtasks!');
  }
});

db.close();

console.log('\n' + '='.repeat(50));
console.log('Debug completed.');
