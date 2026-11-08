package com.ufo.monitoring;

import java.util.Map;
import org.springframework.dao.*;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
class ApiErrors {
    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    ResponseEntity<?> status(org.springframework.web.server.ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode()).body(Map.of("message",error.getReason()==null?"Request failed":error.getReason()));
    }
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<?> duplicate(DataIntegrityViolationException error) {
        return ResponseEntity.status(409).body(Map.of("message","A record with this email, MAC, or device number already exists"));
    }
    @ExceptionHandler(OptimisticLockingFailureException.class)
    ResponseEntity<?> concurrent(OptimisticLockingFailureException error) {
        return ResponseEntity.status(409).body(Map.of("message","Device changed concurrently; retry the request"));
    }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<?> invalid(MethodArgumentNotValidException error) {
        return ResponseEntity.badRequest().body(Map.of("message","Invalid request","errors",error.getBindingResult().getFieldErrors().stream()
            .map(e->e.getField()+": "+e.getDefaultMessage()).toList()));
    }
}
