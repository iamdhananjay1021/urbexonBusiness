// [DECISION] This is the standardized validation system for all new routes
// — see the matching note in middlewares/validate.js for why the older
// rule-object middleware is kept but frozen rather than migrated.
export const validate = (schema) => (req, res, next) => {
    try {
        // Parse and validate
        const validated = schema.parse(req.body);

        // Replace req.body with clean data
        req.body = validated;

        next();
    } catch (err) {
        console.error("[Zod Validation Error]", err.errors);

        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: err.errors?.map(e => ({
                field: e.path.join(".") || "root",
                message: e.message,
            })) || [],
        });
    }
};