package com.mindflow.homelabapi;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/tasks")
public class TaskController {

    private final TaskRepository taskRepository;

    public TaskController(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    public record TaskRequest(String title, Boolean completed) {
    }

    @GetMapping
    public List<Task> getTasks() {
        return taskRepository.findAll();
    }

    @PostMapping
    public Task createTask(@RequestBody TaskRequest request) {
        Task task = new Task();
        task.setTitle(validateTitle(request.title()));
        task.setCompleted(false);

        return taskRepository.save(task);
    }

    @PutMapping("/{id}")
    public Task updateTask(
            @PathVariable Integer id,
            @RequestBody TaskRequest request) {

        Task task = findTask(id);
        task.setTitle(validateTitle(request.title()));

        if (request.completed() != null) {
            task.setCompleted(request.completed());
        }

        return taskRepository.save(task);
    }

    @DeleteMapping("/{id}")
    public void deleteTask(@PathVariable Integer id) {
        Task task = findTask(id);
        taskRepository.delete(task);
    }

    private Task findTask(Integer id) {
        return taskRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Nie znaleziono zadania"
                ));
    }

    private String validateTitle(String title) {
        if (title == null || title.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Tytuł zadania nie może być pusty"
            );
        }

        String cleanedTitle = title.strip();

        if (cleanedTitle.length() > 255) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Tytuł zadania może mieć maksymalnie 255 znaków"
            );
        }

        return cleanedTitle;
    }
}