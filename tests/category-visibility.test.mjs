import assert from "node:assert/strict";
import test from "node:test";

import { visibleCategories } from "../src/app/lib/category-visibility.ts";

test("hides a disabled category and all of its descendants", () => {
  const categories = [
    { id: "summer", parent_id: null, is_enabled: true },
    { id: "summer-prints", parent_id: "summer", is_enabled: true },
    { id: "winter", parent_id: null, is_enabled: false },
    { id: "winter-prints", parent_id: "winter", is_enabled: true },
    { id: "retired", parent_id: null, is_enabled: false },
  ];

  assert.deepEqual(
    visibleCategories(categories).map((category) => category.id),
    ["summer", "summer-prints"]
  );
});
