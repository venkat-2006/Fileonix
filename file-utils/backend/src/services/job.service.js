const jobs = new Map();

export function createJob(job) {
  jobs.set(job.jobId, job);
}

export function getJob(jobId) {
  return jobs.get(jobId);
}
