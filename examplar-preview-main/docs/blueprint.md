# **App Name**: Task Forge

## Core Features:

- Authentication: Allow only authenticated users to use the App.
- Supabase Integration: Use Supabase SDK with Next.js to use with Supabase Auth and Postgres.
- Task List: Display a list of tasks.
- Task Details: Display task details.
- Create Task: Create a new task, detecting parameters like {TOPIC} and {OPTIONS_NUM} in the design instructions, difficulty instructions and difficulty calibration fields.
- Update Task: Update an existing task, also updating parameters if they changed or were added/removed.
- Delete Task: Delete a task and all its parameters.
- Enhance Task Instructions: Use a LLM tool to evaluate the design instructions, difficulty instructions and difficulty calibration texts and find ways to make them clearer and easier to understand.
- Parameter Detection: Detect Parameters and provide fields for them interactively. Provide the ability to use SLM like Gemma 3n or Gemma 3 to provide field helptext and fill in the e.g. hint for each field.

## Style Guidelines:

- Primary color: Deep purple (#4150F2) to convey sophistication and thoughtfulness.
- Background color: White (#FFFFFF), providing a clean and neutral backdrop.
- Accent color: Cyan (#E97AFF) as a vibrant highlight for interactive elements.
- Dark and Light theme. Black (#000000) for further OLED compat.
- Clean and modern fonts for readability and a professional look.
- Simple, clear icons to represent task types and actions.
- Structured layout with clear sections for task details and parameters.
- Subtle animations for transitions and feedback on user interactions.
- Responsive scaling UI to make sure each button without changed text is working properly and hints, parameters