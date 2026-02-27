# Design: Rebuild All Events Page

## 1. Overview

This document outlines the design for rebuilding the "All Events" page in the CulturePass app. The goal is to create a more modern, visually appealing, and user-friendly experience for browsing events.

## 2. Requirements

- Redesign the layout of the "All Events" page.
- Redesign the event cards.
- Add new filtering options.

## 3. Design

### 3.1. Layout

- The page will use a two-column grid layout to display events. This will provide a more dynamic and visually engaging experience, especially on larger screens.

### 3.2. Event Cards

- Each event card will be redesigned to prioritize scannability and user interaction.
- The event **title** and **date** will be the most prominent elements.
- Each card will also include:
  - A smaller event image.
  - The event venue.
  - The event category.
  - A "Save" button to allow users to save events for later.

### 3.3. Filtering

- The existing horizontal list of category filters will be retained.
- A new "Filter" button will be added.
- Tapping the "Filter" button will open a modal with the following options:
  - **Date Filter:**
    - "Today"
    - "This Weekend"
    - A custom date range selector.

## 4. Architecture

- The existing architecture will be used. The page will continue to fetch data from the `/api/events` endpoint using `react-query`.
- The new "Save" button will likely require a new context or a modification to an existing context to manage saved events.
- The new date filter will be implemented on the client-side.

## 5. Components

- The `AllEventsScreen` component in `app/allevents.tsx` will be rebuilt.
- A new `EventCard` component will be created to encapsulate the new event card design.
- A new `FilterModal` component will be created for the advanced filtering options.
