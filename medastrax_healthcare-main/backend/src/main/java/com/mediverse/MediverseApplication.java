package com.mediverse;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EntityScan("com.mediverse.model")
@EnableJpaRepositories("com.mediverse.repository")
@ComponentScan("com.mediverse")
@EnableScheduling
public class MediverseApplication {

    public static void main(String[] args) {
        SpringApplication.run(MediverseApplication.class, args);
    }
}
