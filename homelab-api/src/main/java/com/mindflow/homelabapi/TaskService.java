package com.mindflow.homelabapi;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

@Service
public class TaskService {

    private final TaskRepository taskRepository;

    public TaskService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    public List<Task> getAllTasks() {
        return taskRepository.findAll();
    }

    public Task createTask(
            String title,
            LocalDate dueDate,
            TaskPriority priority
    ) {
        Task task = new Task();

        task.setTitle(validateTitle(title));
        task.setCompleted(false);
        task.setDueDate(dueDate);
        task.setPriority(
                priority != null
                        ? priority
                        : TaskPriority.NORMAL
        );

        return taskRepository.save(task);
    }

    public Task updateTask(
            Integer id,
            String title,
            Boolean completed,
            LocalDate dueDate,
            TaskPriority priority
    ) {
        Task task = findTask(id);

        task.setTitle(validateTitle(title));

        if (completed != null) {
            task.setCompleted(completed);
        }

        task.setDueDate(dueDate);

        if (priority != null) {
            task.setPriority(priority);
        }

        return taskRepository.save(task);
    }

    public void deleteTask(Integer id) {
        Task task = findTask(id);
        taskRepository.delete(task);
    }

    public Task findTask(Integer id) {
        return taskRepository.findById(id)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Task not found"
                        )
                );
    }

    private String validateTitle(String title) {

        if (title == null || title.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Task title cannot be empty"
            );
        }

        String cleanedTitle = title.strip();

        if (cleanedTitle.length() > 255) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Task title cannot exceed 255 characters"
            );
        }

        return cleanedTitle;
    }
}
