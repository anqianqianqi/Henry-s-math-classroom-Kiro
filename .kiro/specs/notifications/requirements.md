# Notification System Requirements

## Overview
In-app notification system to keep students and teachers informed about important events.

## Notification Types

### 1. Class Start Notifications
- Notify students 15 minutes before class starts
- Notify teachers 15 minutes before class starts
- Include class name, time, and topic

### 2. Event Notifications
- **Homework Graded**: Student notified when grade is published
- **New Comment**: Notify when someone comments on your submission
- **Homework Due Soon**: Remind students 24 hours before homework due
- **New Homework Assigned**: Notify students when homework is created
- **New Material Uploaded**: Notify students when teacher uploads materials
- **Submission Received**: Notify teacher when student submits homework

## Features
- In-app notification bell icon with unread count
- Notification dropdown showing recent notifications
- Mark as read/unread
- Clear all notifications
- Notification preferences (future: allow users to customize)

## Database Schema
- `notifications` table with type, recipient, content, read status
- Efficient queries with proper indexing
- RLS policies for privacy

## UI Components
- NotificationBell component in header
- NotificationList dropdown
- Toast notifications for real-time updates (optional)
