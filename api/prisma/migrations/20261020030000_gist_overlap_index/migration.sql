-- GiST index over the [startDate, endDate] interval so the report window query
-- uses an overlap (&&) scan instead of a startDate range scan plus a residual
-- endDate filter. No extension required: tstzrange has a built-in GiST opclass.
CREATE INDEX "TestResult_period_overlap_gist_idx"
  ON "TestResult" USING GIST (tstzrange("startDate", "endDate", '[]'));
