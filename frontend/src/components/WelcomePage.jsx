import React from 'react';
import AuthForm from './AuthForm'; // Import the AuthForm component
import './MainPage.css'; // You might want to create a specific CSS file or reuse an existing one

function WelcomePage() {
  return (
    <div className="container mt-4">
      <div className="card shadow-sm">
        <div className="card-body">
          <h1 className="card-title text-center mb-4">Welcome to PiHap!</h1>

          <p className="lead">
            This application is currently under development and aims to become a central hub for...
            {/* TODO: Add a more detailed description of the app's purpose and future goals */}
          </p>

          <section className="mt-4">
            <h2>What's Next?</h2>
            <p>
              We are actively working on implementing features such as:
            </p>
            <ul>
              <li>User Profiles and Authentication (Partially implemented)</li>
              <li>Community Features (Planned)</li>
              <li>Shop/Location Management (Partially implemented)</li>
              <li>Interactive Maps (Planned)</li>
              {/* TODO: Add more specific planned features */}
            </ul>
            <p>
              Stay tuned for updates as we continue to build and improve PiHap!
            </p>
          </section>

          {/* You could add links to other parts of the app if needed */}
          {/* <div className="text-center mt-4">
            <Link to="/login" className="btn btn-primary me-2">Login</Link>
            <Link to="/register" className="btn btn-secondary">Register</Link>
          </div> */}
        </div>
      </div>

      {/* Embed the AuthForm component */}
      <div className="mt-5"> {/* Add some margin top */}
        <AuthForm />
      </div>
    </div>
  );
}

export default WelcomePage;