package com.mindflow.homelabapi;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/search")
public class SearchController {

    private final WebSearchService webSearchService;

    public SearchController(WebSearchService webSearchService) {
        this.webSearchService = webSearchService;
    }

    @GetMapping
    public String search(
            @RequestParam String q
    ) {
        return webSearchService.search(q);
    }
}