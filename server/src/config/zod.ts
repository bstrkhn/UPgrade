import { z } from 'zod';

/** Default zod validation messages in Bahasa Indonesia (custom messages in schemas take precedence). */
z.config(z.locales.id());
