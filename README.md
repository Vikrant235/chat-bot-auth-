# AI Chatbot 

A responsive, web-based AI chatbot application. This project uses Firebase for backend authentication and database storage, and integrates with the Cohere API for generating AI responses. Built as a pure static site, it runs natively in the browser without requiring Node.js build steps.

## Features
* **Authentication:** Secure Email/Password and Google popup sign-in via Firebase Auth.
* **AI Integration:** Seamless connection to the Cohere API for intelligent chat responses.
* **Chat Management:** Save, retrieve, and delete chat histories using Firebase Firestore.
* **Usage Tracking:** Built-in message and chat limit tracking per user.
* **Responsive UI:** A modern, ChatGPT-style interface with a collapsible sidebar and mobile-friendly design.

## Tech Stack
* **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6 Modules)
* **Backend/Database:** Firebase (Auth, Firestore)
* **AI Provider:** Cohere API
* **Architecture:** Static Site (CDN imports)

## Prerequisites
Before running this project, you will need:
1. A [Firebase](https://firebase.google.com/) account with a web project created.
2. A [Cohere](https://cohere.com/) API key.

## Local Setup
Because this is a static site, you do not need `npm` to install dependencies. 

1. **Clone or Download the Repository:**
   Save the files to your local machine.

2. **Configure Firebase:**
   * Go to the Firebase Console and enable **Authentication** (Email/Password & Google).
   * Enable **Firestore Database**.
   * Copy your Firebase Web App configuration credentials.
   * Open `public/js/firebase-config.js` and paste your keys into the `firebaseConfig` object.

3. **Configure Cohere:**
   * Open `public/js/cohere-service.js`.
   * Input your Cohere API key where required in the configuration.

4. **Run Locally:**
   Use a local web server to run the application to avoid CORS issues. 
   * **VS Code:** Install the "Live Server" extension, open `index.html`, and click "Go Live".
   * **Terminal:** Run `npx serve .` in the project root directory.

## Deployment (Firebase Hosting)
To push this project live to the internet:
1. Ensure your `firebase.json` has the `"public"` directory set correctly (e.g., `"."` or `"public"` depending on your folder structure).
2. Open your terminal in the project root and run:
   ```bash
   npx firebase login
   npx firebase use --add
   npx firebase deploy
