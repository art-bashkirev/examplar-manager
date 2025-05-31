-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.exam_task_parameters (
  parameter_id integer NOT NULL DEFAULT nextval('exam_task_parameters_parameter_id_seq'::regclass),
  task_id text NOT NULL,
  name text NOT NULL,
  placeholder text NOT NULL,
  description text,
  default_value text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT exam_task_parameters_pkey PRIMARY KEY (parameter_id),
  CONSTRAINT exam_task_parameters_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.exam_tasks(id)
);
CREATE TABLE public.exam_tasks (
  id text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  design_instructions text NOT NULL,
  difficulty_instructions text NOT NULL,
  difficulty_calibration text NOT NULL,
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  skill_id uuid,
  level_id uuid,
  exercise_type_id uuid,
  CONSTRAINT exam_tasks_pkey PRIMARY KEY (id),
  CONSTRAINT exam_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT exam_tasks_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skill(id),
  CONSTRAINT exam_tasks_level_id_fkey FOREIGN KEY (level_id) REFERENCES public.level(id),
  CONSTRAINT exam_tasks_exercise_type_id_fkey FOREIGN KEY (exercise_type_id) REFERENCES public.exercise_type(id)
);
CREATE TABLE public.exercise_type (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  CONSTRAINT exercise_type_pkey PRIMARY KEY (id)
);
CREATE TABLE public.level (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  CONSTRAINT level_pkey PRIMARY KEY (id)
);
CREATE TABLE public.skill (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  CONSTRAINT skill_pkey PRIMARY KEY (id)
);