package com.mindflow.homelabapi;

import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    public record TaskRequest(
            String title,
            Boolean completed,
            LocalDate dueDate,
            TaskPriority priority
    ) {
    }

    @GetMapping
    public List<Task> getTasks() {
        return taskService.getAllTasks();
    }

    @PostMapping
    public Task createTask(
            @RequestBody TaskRequest request
    ) {
        return taskService.createTask(
                request.title(),
                request.dueDate(),
                request.priority()
        );
    }

    @PutMapping("/{id}")
    public Task updateTask(
            @PathVariable Integer id,
            @RequestBody TaskRequest request
    ) {
        return taskService.updateTask(
                id,
                request.title(),
                request.completed(),
                request.dueDate(),
                request.priority()
        );
    }

    @DeleteMapping("/{id}")
    public void deleteTask(
            @PathVariable Integer id
    ) {
        taskService.deleteTask(id);
    }
}