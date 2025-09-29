package main

import (
	"time"
)

func NewRunningJobs() *RunningJobs {
	return &RunningJobs{
		jobs: make(map[string]*CompileJob),
	}
}

func (rj *RunningJobs) Add(job *CompileJob) {
	rj.mu.Lock()
	defer rj.mu.Unlock()
	rj.jobs[job.ID] = job
}

func (rj *RunningJobs) Remove(jobID string) {
	rj.mu.Lock()
	defer rj.mu.Unlock()
	delete(rj.jobs, jobID)
}

func (rj *RunningJobs) GetRunningTasks() []map[string]interface{} {
	rj.mu.RLock()
	defer rj.mu.RUnlock()

	var tasks []map[string]interface{}
	for _, job := range rj.jobs {
		elapsed := time.Since(job.StartTime)
		remaining := CompilationTimeout - elapsed
		if remaining < 0 {
			remaining = 0
		}

		tasks = append(tasks, map[string]interface{}{
			"job_id":         job.ID,
			"compiler":       job.Compiler,
			"elapsed_time":   elapsed.Seconds(),
			"remaining_time": remaining.Seconds(),
		})
	}
	return tasks
}

func (rj *RunningJobs) Count() int {
	rj.mu.RLock()
	defer rj.mu.RUnlock()
	return len(rj.jobs)
}
