# Testing Philosophy

## Unit Test Guidelines

Unit tests should be **simple, readable, and focused on core functionality**. More tests is not necessarily better - prioritize quality over quantity.

**Required Format:**
- Use **Arrange/Act/Assert** pattern with explicit comments:
  ```typescript
  it('should do something', async () => {
    // Arrange
    // ... setup code ...

    // Act
    // ... execute code ...

    // Assert
    // ... verify results ...
  });
  ```

**Principles:**
1. **Simplicity first**: Tests should be easy to read and understand at a glance
2. **Cover important edge cases**: Focus on critical paths and error scenarios
3. **Avoid over-testing**: Don't test implementation details or trivial code
4. **Clear test names**: Test names should clearly describe what is being tested
5. **One assertion per concept**: Group related assertions, but keep tests focused

**What to Test:**
- Core business logic and important workflows
- Error handling and edge cases
- Integration points between services
- Critical decision points (e.g., deal detection, S3 upload decisions)

**What NOT to Test:**
- Simple getters/setters
- Trivial utility functions
- Framework/library code
- Implementation details that don't affect behavior

After adding tests you must always verify that they are passing.
