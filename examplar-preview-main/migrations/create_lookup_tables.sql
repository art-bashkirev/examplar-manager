-- Create skill table
CREATE TABLE public.skill (
  id uuid NOT NULL PRIMARY KEY,
  name text NOT NULL UNIQUE
);

-- Create level table
CREATE TABLE public.level (
  id uuid NOT NULL PRIMARY KEY,
  name text NOT NULL UNIQUE
);

-- Create exercise_type table
CREATE TABLE public.exercise_type (
  id uuid NOT NULL PRIMARY KEY,
  name text NOT NULL UNIQUE
);

-- Add foreign key columns to exam_tasks table
ALTER TABLE public.exam_tasks
ADD COLUMN skill_id uuid NULL,
ADD COLUMN level_id uuid NULL,
ADD COLUMN exercise_type_id uuid NULL;

-- Remove existing skill, level, and exercise_type columns
ALTER TABLE public.exam_tasks
DROP COLUMN skill,
DROP COLUMN level,
DROP COLUMN exercise_type;

-- Add foreign key constraints to exam_tasks table
ALTER TABLE public.exam_tasks
ADD CONSTRAINT exam_tasks_skill_id_fkey
FOREIGN KEY (skill_id) REFERENCES public.skill(id)
ON UPDATE CASCADE
ON DELETE SET NULL;
ALTER TABLE public.exam_tasks
ADD CONSTRAINT exam_tasks_level_id_fkey
FOREIGN KEY (level_id) REFERENCES public.level(id)
ON UPDATE CASCADE
ON DELETE SET NULL;
ALTER TABLE public.exam_tasks
ADD CONSTRAINT exam_tasks_exercise_type_id_fkey
FOREIGN KEY (exercise_type_id) REFERENCES public.exercise_type(id)
ON UPDATE CASCADE
ON DELETE SET NULL;