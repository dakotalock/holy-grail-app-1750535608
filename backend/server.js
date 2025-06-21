const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs'); // For checking file existence, though sqlite3 handles creation implicitly

const app = express();
const PORT = process.env.PORT || 3000; // Node.js convention often uses 3000, Flask uses 5000.
const DB_FILE = 'counter.db';

// Middleware to parse JSON bodies for API requests
app.use(express.json());

// --- Database Initialization ---
/**
 * Initializes the SQLite database:
 * 1. Connects to the database file.
 * 2. Creates the 'counter' table if it doesn't exist.
 * 3. Inserts an initial row with 'value = 0' if the table is empty.
 * @returns {Promise<sqlite3.Database>} A promise that resolves with the database instance.
 */
async function initializeDatabase() {
    return new Promise((resolve, reject) => {
        // Connect to the SQLite database. If the file doesn't exist, it will be created.
        const db = new sqlite3.Database(DB_FILE, (err) => {
            if (err) {
                console.error('Error opening database:', err.message);
                return reject(err);
            }
            console.log(`Connected to the SQLite database: ${DB_FILE}`);

            // Create the 'counter' table if it doesn't already exist.
            // This is a robust solution for first-time runs.
            db.run(`CREATE TABLE IF NOT EXISTS counter (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                value INTEGER NOT NULL DEFAULT 0
            )`, (err) => {
                if (err) {
                    console.error('Error creating counter table:', err.message);
                    db.close(); // Close DB if table creation fails
                    return reject(err);
                }
                console.log('Counter table checked/created.');

                // Check if there's any row in the 'counter' table.
                // If not, insert the initial value of 0.
                db.get("SELECT COUNT(*) as count FROM counter", (err, row) => {
                    if (err) {
                        console.error('Error checking initial row count:', err.message);
                        db.close();
                        return reject(err);
                    }
                    if (row.count === 0) {
                        db.run("INSERT INTO counter (value) VALUES (?)", [0], (err) => {
                            if (err) {
                                console.error('Error inserting initial counter value:', err.message);
                                db.close();
                                return reject(err);
                            }
                            console.log('Initial counter value (0) inserted.');
                            resolve(db); // Database is ready
                        });
                    } else {
                        console.log('Counter table already initialized with data.');
                        resolve(db); // Database is ready
                    }
                });
            });
        });
    });
}

let db; // Global variable to hold the database connection

// Start database initialization and then the server
initializeDatabase()
    .then(database => {
        db = database; // Store the opened database connection
        // Start the Express server only after the database is successfully initialized
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
            console.log("----------------------------------------------------------------------------------");
            console.log("NOTE: The backend is implemented with Node.js/Express as per final requirements,");
            console.log("      which deviates from the Python/Flask specified in the original plan.");
            console.log("----------------------------------------------------------------------------------");
        });
    })
    .catch(err => {
        console.error('Failed to initialize database, exiting application:', err);
        process.exit(1); // Exit the process if database initialization fails critically
    });

// --- API Endpoints Specification ---

/**
 * Endpoint 1: Get Current Counter Value
 * Method: GET
 * Path: /api/counter
 * Description: Retrieves the current value of the counter from the database.
 * Response (200 OK): { "value": <current_integer_value> }
 * Error Response (500 Internal Server Error): { "error": "Failed to retrieve counter value." }
 */
app.get('/api/counter', (req, res) => {
    console.log('GET /api/counter request received.');
    db.get("SELECT value FROM counter WHERE id = 1", (err, row) => {
        if (err) {
            console.error('Database error on GET /api/counter:', err.message);
            // Proper error handling: return 500 status with a descriptive JSON error
            return res.status(500).json({ error: "Failed to retrieve counter value." });
        }
        // If no row is found (should ideally not happen due to initialization logic, but as a safeguard)
        if (!row) {
            console.warn('No counter row found (id=1), returning default 0.');
            return res.status(200).json({ value: 0 }); // Return 0 as a default if no entry exists
        }
        // Success: return the current value
        res.json({ value: row.value });
        console.log(`GET /api/counter response: { value: ${row.value} }`);
    });
});

/**
 * Endpoint 2: Increment Counter Value
 * Method: POST
 * Path: /api/counter/increment
 * Description: Increments the counter value in the database by 1 and returns the new value.
 * Request Body: None (or empty JSON {})
 * Response (200 OK): { "value": <new_integer_value> }
 * Error Response (500 Internal Server Error): { "error": "Failed to increment counter value." }
 */
app.post('/api/counter/increment', (req, res) => {
    console.log('POST /api/counter/increment request received.');
    // Use db.serialize() for sequential execution of statements if needed,
    // though for a single UPDATE followed by a SELECT, it's not strictly necessary for atomicity
    // as SQLite handles single statements atomically. But it ensures order.
    db.serialize(() => {
        // Update the counter value by 1 for the row with id=1
        db.run("UPDATE counter SET value = value + 1 WHERE id = 1", function(err) {
            if (err) {
                console.error('Database error on UPDATE /api/counter/increment:', err.message);
                // Proper error handling for update failure
                return res.status(500).json({ error: "Failed to increment counter value." });
            }
            // After successful update, retrieve the new value to send back to the client
            db.get("SELECT value FROM counter WHERE id = 1", (err, row) => {
                if (err) {
                    console.error('Database error on SELECT after increment:', err.message);
                    // Proper error handling for select failure after update
                    return res.status(500).json({ error: "Failed to retrieve new counter value." });
                }
                if (!row) {
                    // This case should ideally not happen if the UPDATE succeeded for id=1
                    console.error('No row found after increment, potential data inconsistency.');
                    return res.status(500).json({ error: "Counter row disappeared after increment." });
                }
                // Success: return the new incremented value
                res.json({ value: row.value });
                console.log(`POST /api/counter/increment response: { value: ${row.value} }`);
            });
        });
    });
});

// --- Serve Frontend Components with Layout Notes ---
/**
 * Serve the single HTML file with inline CSS and JavaScript.
 * This approach avoids CORS issues and keeps the demonstration extremely simple.
 */
app.get('/', (req, res) => {
    console.log('GET / request received, serving frontend HTML.');
    res.type('text/html'); // Set Content-Type header to HTML
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Simple Full-Stack Counter</title>
    <style>
        /* Minimal CSS for layout and styling */
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background-color: #e0f2f7; /* Light blue background */
            color: #333;
            line-height: 1.6;
        }
        #app {
            background-color: #ffffff;
            padding: 40px 60px;
            border-radius: 12px;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15); /* More pronounced shadow */
            text-align: center;
            max-width: 550px;
            width: 90%;
            border: 1px solid #cce7ee;
        }
        h1 {
            color: #007bff; /* Primary blue for title */
            margin-bottom: 30px;
            font-size: 2.5em; /* Larger title */
            font-weight: 600;
        }
        #counter-display {
            font-size: 5em; /* Very large font for counter */
            font-weight: bold;
            color: #28a745; /* Green for counter value */
            margin-bottom: 40px;
            padding: 20px 0;
            border: 3px solid #28a745;
            border-radius: 10px;
            background-color: #eafbea; /* Very light green background */
            display: inline-block; /* Shrink to content */
            min-width: 150px; /* Ensure minimum width */
            transition: all 0.2s ease-in-out; /* Smooth transition for value changes */
        }
        #counter-display.animating {
            transform: scale(1.05); /* Slight pop effect */
            background-color: #d4edda; /* Darker green during animation */
        }
        #increment-button {
            background-color: #007bff;
            color: white;
            border: none;
            padding: 18px 35px; /* Larger button */
            font-size: 1.3em;
            border-radius: 8px;
            cursor: pointer;
            transition: background-color 0.3s ease, transform 0.1s ease;
            box-shadow: 0 4px 10px rgba(0, 123, 255, 0.2);
        }
        #increment-button:hover {
            background-color: #0056b3;
            transform: translateY(-2px); /* Slight lift on hover */
        }
        #increment-button:active {
            transform: translateY(0); /* Press effect */
            box-shadow: 0 2px 5px rgba(0, 123, 255, 0.2);
        }
        #increment-button:disabled {
            background-color: #cccccc;
            cursor: not-allowed;
            box-shadow: none;
            transform: none;
        }
        #status-message {
            margin-top: 30px;
            font-size: 0.95em;
            color: #6c757d; /* Muted text color */
            min-height: 20px; /* Reserve space to prevent layout shifts */
            opacity: 0.9;
        }
        .error {
            color: #dc3545; /* Red for errors */
            font-weight: bold;
        }
        .success {
            color: #28a745; /* Green for success */
        }
        .loading {
            color: #ffc107; /* Orange for loading */
        }
    </style>
</head>
<body>
    <div id="app">
        <h1>Simple Full-Stack Counter</h1>
        <div id="counter-display">0</div>
        <button id="increment-button">Increment Counter</button>
        <p id="status-message"></p>
    </div>

    <script>
        // Get references to DOM elements
        const counterDisplay = document.getElementById('counter-display');
        const incrementButton = document.getElementById('increment-button');
        const statusMessage = document.getElementById('status-message');

        /**
         * Updates the status message displayed to the user.
         * @param {string} message - The text message to display.
         * @param {string} type - A class name ('loading', 'success', 'error') to style the message.
         */
        function updateStatus(message, type = '') {
            statusMessage.textContent = message;
            statusMessage.className = type; // Apply class for styling
        }

        /**
         * Animates the counter display when its value changes.
         */
        function animateCounterDisplay() {
            counterDisplay.classList.add('animating');
            setTimeout(() => {
                counterDisplay.classList.remove('animating');
            }, 200); // Animation duration
        }

        /**
         * Fetches the current counter value from the backend API.
         * Handles loading states, updates UI, and manages errors.
         */
        async function fetchCounter() {
            updateStatus('Loading counter...', 'loading');
            incrementButton.disabled = true; // Disable button to prevent multiple clicks
            try {
                const response = await fetch('/api/counter'); // GET request to backend
                if (!response.ok) {
                    // If response is not OK (e.g., 4xx, 5xx status)
                    const errorData = await response.json(); // Attempt to parse error message from body
                    throw new Error(errorData.error || \`HTTP error! Status: \${response.status}\`);
                }
                const data = await response.json(); // Parse JSON response
                counterDisplay.textContent = data.value; // Update display with fetched value
                updateStatus('Counter loaded successfully.', 'success');
            } catch (error) {
                console.error('Error fetching counter:', error);
                updateStatus(\`Failed to load counter: \${error.message}\`, 'error');
                counterDisplay.textContent = 'Error!'; // Indicate error on display
            } finally {
                incrementButton.disabled = false; // Re-enable button
            }
        }

        /**
         * Increments the counter value by sending a POST request to the backend API.
         * Handles loading states, updates UI, and manages errors.
         */
        async function incrementCounter() {
            updateStatus('Incrementing counter...', 'loading');
            incrementButton.disabled = true; // Disable button to prevent rapid clicks
            try {
                const response = await fetch('/api/counter/increment', {
                    method: 'POST', // POST request to increment
                    headers: {
                        'Content-Type': 'application/json' // Specify content type
                    },
                    body: JSON.stringify({}) // Empty body as per spec (or omit body entirely)
                });
                if (!response.ok) {
                    // If response is not OK
                    const errorData = await response.json();
                    throw new Error(errorData.error || \`HTTP error! Status: \${response.status}\`);
                }
                const data = await response.json(); // Parse JSON response
                counterDisplay.textContent = data.value; // Update display with new value
                animateCounterDisplay(); // Trigger animation
                updateStatus('Counter incremented successfully!', 'success');
            } catch (error) {
                console.error('Error incrementing counter:', error);
                updateStatus(\`Failed to increment counter: \${error.message}\`, 'error');
            } finally {
                incrementButton.disabled = false; // Re-enable button
            }
        }

        // --- Event Listeners ---
        // Fetch counter value when the DOM content is fully loaded
        document.addEventListener('DOMContentLoaded', fetchCounter);
        // Add click listener to the increment button
        incrementButton.addEventListener('click', incrementCounter);
    </script>
</body>
</html>
    `);
});

// --- Basic Error Handling for Unhandled Routes ---
// This middleware catches any requests that don't match the above routes
app.use((req, res) => {
    console.warn(`404 Not Found: ${req.method} ${req.originalUrl}`);
    res.status(404).send('404: Not Found');
});