import { test } from "node:test"
import assert from "node:assert/strict"
import { asForm, asRow, display } from "./form-display.ts"
import { fieldByKey } from "./application-form.ts"

test("non-object data coerces to {}", () => {
  for (const bad of [null, undefined, "x", 5, [1]]) assert.deepEqual(asForm(bad), {})
  assert.deepEqual(asRow(null), {})
})

test("display falls back to String(v) on wrong types, never NaN/throws", () => {
  assert.equal(display(fieldByKey("expected_salary")!, "abc"), "abc")
  assert.equal(display(fieldByKey("expected_salary")!, 30000), "฿30,000")
  assert.equal(display(fieldByKey("has_work_experience")!, "yes"), "yes")
  assert.equal(display(fieldByKey("has_work_experience")!, true), "มี")
  assert.equal(display(fieldByKey("date_of_birth")!, 123), "123")
  assert.equal(display(fieldByKey("nickname")!, { a: 1 }), '{"a":1}')
})
