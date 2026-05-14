# Contributing to ArisSecure

Thanks for your interest in contributing! 🙌

## How to Contribute

### 1. Report Issues
- Use [GitHub Issues](https://github.com/Naren15022005/ArisSecure-ExtensionVS/issues)
- Include: code example, expected behavior, actual behavior
- Label with appropriate tags

### 2. Suggest Features
- Open a [GitHub Discussion](https://github.com/Naren15022005/ArisSecure-ExtensionVS/discussions)
- Describe the use case
- Explain why it matters

### 3. Submit Code

#### 1. Fork & Clone
```bash
git clone https://github.com/YOUR_USERNAME/ArisSecure-ExtensionVS.git
cd ArisSecure-ExtensionVS
npm install
```

#### 2. Create Feature Branch
```bash
git checkout -b feature/my-feature
```

#### 3. Make Changes
- Write tests first (TDD preferred)
- Implement feature
- Ensure all tests pass

#### 4. Test Thoroughly
```bash
npm test          # All pass?
npm run lint      # No errors?
npm run build     # Clean build?
```

#### 5. Commit
```bash
git commit -m "feat: add my feature"

# Use conventional commits:
# feat: new feature
# fix: bug fix
# docs: documentation
# test: tests only
# refactor: code cleanup
```

#### 6. Push & PR
```bash
git push origin feature/my-feature
# Create PR on GitHub
```

## Guidelines

### Code Quality
- ✅ All tests must pass
- ✅ No linting errors
- ✅ TypeScript strict mode
- ✅ Meaningful commit messages

### Testing
- Add tests for new features
- Aim for >85% coverage
- Test edge cases
- Test with various inputs

### Documentation
- Update README if user-facing
- Add JSDoc comments to functions
- Document breaking changes
- Include examples where helpful

### Performance
- No unnecessary dependencies
- Optimize hot paths
- Monitor build size (keep < 650kb)

## Code of Conduct

- Be respectful and inclusive
- No harassment or discrimination
- Constructive feedback only
- Foster a welcoming environment

## Questions?

- [GitHub Discussions](https://github.com/Naren15022005/ArisSecure-ExtensionVS/discussions)
- [GitHub Issues](https://github.com/Naren15022005/ArisSecure-ExtensionVS/issues)

Thank you for contributing! 🎉
