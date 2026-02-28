/**
 * CulturePassAU — Firebase Cloud Functions entry point
 *
 * Mounts the entire Express app as a single Cloud Function named `api`.
 * All routes are reachable at:
 *   https://us-central1-<project>.cloudfunctions.net/api/<route>
 *   or via Firebase Hosting rewrite: /api/** → api function
 */

import * as functions from 'firebase-functions';
import { app } from './app';

export const api = functions.https.onRequest(app);
