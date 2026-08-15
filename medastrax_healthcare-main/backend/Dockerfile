# Stage 1: Build
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn clean package -DskipTests -B

# Stage 2: Run
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/mediverse-backend-1.0.0.jar app.jar

# Render sets PORT env variable automatically
EXPOSE ${PORT:-8083}

ENTRYPOINT ["java", "-jar", "app.jar"]
