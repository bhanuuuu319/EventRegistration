# EventRegister — Firebase + Bootstrap + JavaScript

A responsive event-management project with student and admin dashboards, Firebase Authentication, Firestore data, password-strength feedback, confirmation before registration, event CRUD for admins, and student/registration management.

## 1. Important: correct the Firebase config

Open `app.js` and check the `firebaseConfig`. The config should match the Firebase Web App shown in Firebase Console → Project settings → General → Your apps. If your actual API key differs, copy the exact value from Firebase Console. A Firebase web API key is not a password, but never put service-account/private keys in browser code.

## 2. Enable Firebase services

In Firebase Console for project `eventregistration-2b0a2`:
1. Authentication → Sign-in method → enable **Email/Password**.
2. Firestore Database → create a database.
3. Authentication → Settings → Authorized domains: include `localhost` for local development and your deployed domain.
4. Firestore → Rules: paste the rules below and Publish.

## 3. Firestore rules (starter rules; roles are stored in users/{uid})

These rules make students read events and their own registration records; admins (manually configured in Firestore) can manage events, read the student directory, and read all registrations. Users can only create their own profile with role `student`; users cannot self-promote. Keep the admin role field writable only by trusted console/admin tooling.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function isSelf(uid) { return signedIn() && request.auth.uid == uid; }
    function userDoc() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid));
    }
    function isAdmin() {
      return signedIn() && userDoc().data.role == 'admin';
    }

    match /users/{uid} {
      allow create: if isSelf(uid)
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.role == 'student'
        && request.resource.data.email == request.auth.token.email;
      allow read: if isSelf(uid) || isAdmin();
      allow update: if isAdmin() || (isSelf(uid)
        && request.resource.data.role == resource.data.role
        && request.resource.data.uid == resource.data.uid
        && request.resource.data.email == resource.data.email
        && request.resource.data.diff(resource.data).affectedKeys()
          .hasOnly(['lastLoginAt', 'lastLoginText', 'name']));
      allow delete: if isAdmin();
    }

    match /events/{eventId} {
      allow read: if signedIn();
      allow create: if isAdmin();
      allow update, delete: if isAdmin();
    }

    match /registrations/{registrationId} {
      allow read: if signedIn() && (isAdmin() || resource.data.studentUid == request.auth.uid);
      allow create: if signedIn()
        && request.resource.data.studentUid == request.auth.uid
        && request.resource.data.studentEmail == request.auth.token.email
        && request.resource.data.eventId is string
        && request.resource.data.eventName is string;
      allow update, delete: if isAdmin();
    }
  }
}
```

**Production note:** Firestore rules cannot reliably prevent two simultaneous registrations from exceeding an event's capacity or guarantee duplicate-registration prevention in every race condition. For production, move registration creation into a trusted Cloud Function/transaction and add App Check. The front-end does a duplicate check for the demo.

## 4. Manually make your admin account

1. First, run the app and use **Create account** to create your own account with the email you want as admin.
2. Firebase Console → Authentication → Users: copy that account's **UID**.
3. Firestore Database → `users` collection → create/open a document whose document ID is exactly that UID.
4. Set fields:
   - `uid` (string): same UID
   - `name` (string): your display name
   - `email` (string): exact account email
   - `role` (string): `admin`
   - `createdAt` (timestamp, optional)
5. Sign out and sign in again. The Admin dashboard will appear. Do not expose an admin signup option on the login page.

New signups are always assigned `role: student` by the app and security rules. Never let a user select their role in the UI.

## 5. Run locally

Because this uses JavaScript ES modules, do **not** open `index.html` with `file://`.
- Open the project folder in VS Code.
- Install the VS Code extension **Live Server**, if needed.
- Right-click `index.html` → **Open with Live Server**. Or run a local static server from the folder.
- Sign up / sign in with a test account. Keep the browser console open if Firebase reports a configuration/rules error.

## 6. Included features

- Email/password sign-up and login through Firebase Auth.
- Duplicate email handling (`Email already exists`).
- Password checks: 8+ characters, uppercase, lowercase, number, special character; live strength indicator.
- Form validation and show/hide password.
- Student dashboard with Sports, Dance, Singing, Arts, Technology and Other filters.
- Sports examples: Cricket, Volleyball, Badminton.
- Confirmation before event registration; date, time and venue displayed.
- Admin dashboard: create/edit/delete events, student directory, last sign-in text, confirmed interests, dashboard counts.
- Responsive layout, animations, reduced-motion support.

## 7. Honest limitation about "students who logged in"

The dashboard shows student accounts and the most recent login time **when this app successfully records a login**. Firebase Authentication's exact sign-in audit history is not exposed directly to a browser app. For a full audit trail or account disable/delete controls, use Firebase Admin SDK in a secure server/Cloud Function; never put Admin SDK credentials in front-end code.


## Forgot password
The login page includes a Forgot password? link. A student enters their registered email in the Email address field and clicks the link. Firebase Authentication sends the password-reset email using `sendPasswordResetEmail`.

Before testing, open Firebase Console → Authentication → Sign-in method (or Sign-in providers) and enable Email/Password. In Authentication → Templates, review the Password reset email template. In Authentication → Settings → Authorized domains, ensure the domain you use is authorized (for local development, `localhost` is commonly present; add `127.0.0.1` if you use that host and Firebase requires it). Check spam/junk if the email does not arrive.
