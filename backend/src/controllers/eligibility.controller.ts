import type { RequestHandler } from "express";
import { findEligibleSchemes } from "../services/eligibility.service.js";

export const checkEligibility: RequestHandler = async (req, res) => {
  const results = await findEligibleSchemes(req.body);
  res.json({
    data: {
      results,
      count: results.length,
      basis: "RULE_BASED_POSSIBLE_MATCH",
      disclaimer: "Possible matches only. The relevant government department makes the final eligibility decision.",
    },
  });
};
