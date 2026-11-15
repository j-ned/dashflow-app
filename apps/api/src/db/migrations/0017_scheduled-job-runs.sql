CREATE TABLE "scheduled_job_runs" (
	"job_name" varchar(64) PRIMARY KEY NOT NULL,
	"last_slot" timestamp with time zone NOT NULL
);
