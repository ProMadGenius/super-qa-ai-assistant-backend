# Product Overview

## QA ChatCanvas Backend API

AI-powered QA documentation generation and refinement system that transforms Jira tickets into comprehensive test documentation through conversational interaction.

### Core Purpose
- **Primary Function**: Generate structured QA documentation from Jira ticket data using AI analysis
- **Target Users**: QA engineers, testers, and development teams working with Jira
- **Key Value**: Automates the creation of acceptance criteria, test cases, and QA documentation while maintaining quality and consistency

### Key Features
- **Ticket Analysis**: Converts raw Jira ticket data into structured QA documentation
- **Conversational Refinement**: Interactive chat interface for iterating on generated documentation
- **Multiple Test Formats**: Supports Gherkin, step-by-step, and table-based test case formats
- **QA Profile Customization**: Configurable testing categories and preferences
- **Structured Output**: Validates all generated content against strict schemas

### Integration Context
- **Chrome Extension Frontend**: Works as backend API for a Chrome extension that operates within Jira
- **AI-First Architecture**: Built around Vercel AI SDK v5 for reliable AI interactions
- **Deployment Target**: Vercel platform with PM2 support for Ubuntu 22 deployments