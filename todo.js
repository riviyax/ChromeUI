/**
 * todo.js
 * Handles all logic for the To-Do List feature, including storage in localStorage.
 */

document.addEventListener('DOMContentLoaded', () => {
    const todoInput = document.getElementById('todo-input');
    const addTodoBtn = document.getElementById('add-todo-btn');
    const todoList = document.getElementById('todo-list');
    
    // Key for localStorage
    const STORAGE_KEY = 'newtab_todo_tasks';

    /**
     * Loads tasks from localStorage.
     * @returns {Array<Object>} The array of stored tasks.
     */
    const loadTasks = () => {
        const tasksJson = localStorage.getItem(STORAGE_KEY);
        return tasksJson ? JSON.parse(tasksJson) : [];
    };

    /**
     * Saves the current task array to localStorage.
     * @param {Array<Object>} tasks - The array of tasks to save.
     */
    const saveTasks = (tasks) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    };

    /**
     * Renders all tasks in the UI.
     */
    const renderTasks = () => {
        const tasks = loadTasks();
        todoList.innerHTML = ''; // Clear existing list

        tasks.forEach((task, index) => {
            const listItem = document.createElement('li');
            // Use index as a data attribute to easily reference the task
            listItem.setAttribute('data-index', index); 
            listItem.className = `todo-item ${task.completed ? 'completed' : ''}`;
            
            // Text span for the task description
            const textSpan = document.createElement('span');
            textSpan.className = 'todo-item-text';
            textSpan.textContent = task.text;
            // Use event delegation for click to handle dynamic elements
            textSpan.addEventListener('click', () => toggleTaskCompletion(index));

            // Delete button
            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-todo-btn';
            deleteButton.innerHTML = '<i class="bi bi-x-lg"></i>'; // Bootstrap X icon
            // Use event delegation for click to handle dynamic elements
            deleteButton.addEventListener('click', () => deleteTask(index));

            listItem.appendChild(textSpan);
            listItem.appendChild(deleteButton);
            todoList.appendChild(listItem);
        });
    };

    /**
     * Adds a new task from the input field.
     */
    const addTask = () => {
        const text = todoInput.value.trim();

        if (text) {
            const tasks = loadTasks();
            const newTask = { text, completed: false };
            tasks.push(newTask);
            saveTasks(tasks);
            renderTasks();
            todoInput.value = ''; // Clear input
        }
    };

    /**
     * Toggles the completion status of a task.
     * @param {number} index - The index of the task to toggle.
     */
    const toggleTaskCompletion = (index) => {
        const tasks = loadTasks();
        if (tasks[index]) {
            tasks[index].completed = !tasks[index].completed;
            saveTasks(tasks);
            renderTasks();
        }
    };

    /**
     * Deletes a task by its index.
     * @param {number} index - The index of the task to delete.
     */
    const deleteTask = (index) => {
        let tasks = loadTasks();
        tasks.splice(index, 1); // Remove 1 element at the given index
        saveTasks(tasks);
        renderTasks();
    };


    // Event Listeners
    addTodoBtn.addEventListener('click', addTask);
    
    // Allow adding task with Enter key
    todoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTask();
        }
    });

    // Initial render when the page loads
    renderTasks();
});

const panellockValue = localStorage.getItem("lock-toggle");
const msg = document.getElementById("errmsg");

// Check if the stored value is the string "true"
if (panellockValue === "true") {
  msg.innerText = "Please lock the panels to use the todo list.";
} else {
  // Clear the message if the lock is not set to "true" (e.g., it's "false", null, or undefined)
  msg.innerText = "";
}