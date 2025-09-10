### General Rules for Claude Code

1. **Release Context**

   * The application is **not**  released, so **no migrations** are required.
   * Focus only on new features, improvements, or fixes.

2. **Tech Stack Alignment**

   * All implementations must align with our tech stack:

     * **Frontend/UI**: React, TypeScript, Vite
     * **State Management**: Zustand (with Immer middleware where applicable)
     * **Node Graph**: React Flow
     * **3D Rendering**: Three.js
     * **Build & Tooling**: Node.js 22, ESLint, Prettier
     * **Testing**: Skipped (manual testing only — see rule 6)

3. **Code Quality & Standards**

   * Do **not** write code comments.
   * Always apply **industry best practices** as a **senior tech lead or software engineer**.
   * After implementation, **self-review** your work as a **senior solution architect**, ensuring maintainability, performance, and extensibility.

4. **Clarifications Before Coding**

   * Before writing any code, ask me questions until you are at least **90% confident** about requirements and all ambiguity is removed.

5. **Planning Before Execution**

   * Create a **personal to-do list** before implementation so nothing is overlooked.

6. **Version Control Restrictions**

   * Do **not** commit, push code, or create branches. I will handle all version control operations.

7. **Testing Approach**

   * Do not create or run unit, integration, or end-to-end tests.
   * I will perform **manual testing** and provide feedback. You will fix issues based on my observations.
