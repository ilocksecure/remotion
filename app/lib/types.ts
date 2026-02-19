import { z } from "zod";
import {
  PaletteSchema,
  DesignBriefSchema,
  ComponentStyleSchema,
  ComponentSpecSchema,
  BackgroundSchema,
  LayerSpecSchema,
  LayoutSpecSchema,
  EditInstructionSchema,
  ComponentChangesSchema,
  EditResponseSchema,
} from "./schemas";

export type Palette = z.infer<typeof PaletteSchema>;
export type DesignBrief = z.infer<typeof DesignBriefSchema>;
export type ComponentStyle = z.infer<typeof ComponentStyleSchema>;
export type ComponentSpec = z.infer<typeof ComponentSpecSchema>;
export type Background = z.infer<typeof BackgroundSchema>;
export type LayerSpec = z.infer<typeof LayerSpecSchema>;
export type LayoutSpec = z.infer<typeof LayoutSpecSchema>;
export type EditInstruction = z.infer<typeof EditInstructionSchema>;
export type ComponentChanges = z.infer<typeof ComponentChangesSchema>;
export type EditResponse = z.infer<typeof EditResponseSchema>;
