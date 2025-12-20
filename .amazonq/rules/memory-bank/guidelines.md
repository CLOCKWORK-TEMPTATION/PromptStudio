# PromptStudio Development Guidelines

## Code Quality Standards

### TypeScript Usage Patterns
- **Comprehensive Type Safety**: All files use strict TypeScript with explicit type definitions
- **Interface-First Design**: Complex data structures defined as interfaces with detailed properties
- **Type Exports**: Centralized type definitions in `src/types/index.ts` with clear categorization
- **Generic Type Parameters**: Extensive use of generics for reusable components and services
- **Union Types**: Strategic use of union types for controlled value sets (e.g., `'light' | 'dark'`)

### Import Organization Standards
- **Grouped Imports**: External libraries first, then internal modules, separated by blank lines
- **Destructured Imports**: Prefer destructured imports for better tree-shaking
- **Relative Path Consistency**: Use `@/` alias for src directory imports
- **Type-Only Imports**: Separate type imports when used only for typing

### Naming Conventions
- **PascalCase**: React components, TypeScript interfaces, classes, and enums
- **camelCase**: Variables, functions, methods, and object properties
- **SCREAMING_SNAKE_CASE**: Constants and enum values
- **kebab-case**: File names and CSS classes
- **Descriptive Names**: Self-documenting variable and function names

### Component Structure Patterns
- **Functional Components**: Consistent use of function declarations over arrow functions
- **Props Interface**: Each component has a dedicated props interface
- **Default Props**: Use default parameter values instead of defaultProps
- **Component Organization**: Props interface, component function, then exports

## Architectural Patterns

### Service Layer Architecture
- **Service Classes**: Business logic encapsulated in service classes with static methods
- **Dependency Injection**: Services accept dependencies through constructor or method parameters
- **Error Handling**: Comprehensive try-catch blocks with specific error types
- **Async/Await**: Consistent use of async/await over Promise chains
- **Database Abstraction**: Prisma ORM used consistently across all data access

### State Management Patterns
- **Zustand Stores**: Lightweight state management with clear store separation
- **Store Composition**: Multiple focused stores rather than single monolithic store
- **Immutable Updates**: State updates follow immutability principles
- **Computed Values**: Derived state calculated in selectors or computed properties

### API Design Patterns
- **RESTful Endpoints**: Clear resource-based URL structure
- **Request/Response Types**: Strongly typed API interfaces
- **Error Response Format**: Consistent error response structure
- **Validation**: Input validation using Zod schemas
- **Middleware Pattern**: Reusable middleware for authentication, logging, and error handling

## React Component Patterns

### Hook Usage Standards
- **Custom Hooks**: Business logic extracted into reusable custom hooks
- **Hook Dependencies**: Careful dependency array management in useEffect
- **State Initialization**: Lazy initial state for expensive computations
- **Cleanup Functions**: Proper cleanup in useEffect return functions

### Conditional Rendering Patterns
- **Ternary Operators**: Simple conditional rendering with ternary operators
- **Logical AND**: Short-circuit evaluation for conditional display
- **Early Returns**: Guard clauses for complex conditional logic
- **Null Coalescing**: Use of `??` operator for default values

### Event Handling Patterns
- **Inline Handlers**: Simple event handlers defined inline
- **Callback Functions**: Complex logic extracted to separate functions
- **Event Delegation**: Efficient event handling for dynamic lists
- **Prevent Default**: Explicit preventDefault() calls where needed

## Styling and UI Patterns

### Tailwind CSS Usage
- **Utility-First**: Consistent use of Tailwind utility classes
- **Responsive Design**: Mobile-first responsive design with breakpoint prefixes
- **Dark Mode Support**: Conditional classes based on theme state
- **Component Variants**: Use of clsx for conditional class application
- **Custom Components**: Radix UI components for complex interactions

### Theme Implementation
- **Theme Context**: Centralized theme management through Zustand store
- **Conditional Styling**: Theme-aware styling using conditional classes
- **CSS Variables**: Custom properties for theme-specific values
- **Consistent Spacing**: Standardized spacing scale throughout application

## Data Management Patterns

### Database Interaction
- **Prisma Client**: Consistent use of Prisma for all database operations
- **Transaction Management**: Proper transaction handling for complex operations
- **Query Optimization**: Efficient queries with appropriate includes and selects
- **Migration Strategy**: Structured database migrations with rollback support

### Caching Strategies
- **Semantic Caching**: Vector-based similarity matching for intelligent caching
- **TTL Management**: Time-based cache expiration with configurable durations
- **Cache Invalidation**: Strategic cache invalidation based on data changes
- **Memory Management**: Efficient memory usage in caching implementations

### Data Validation
- **Schema Validation**: Zod schemas for runtime type checking
- **Input Sanitization**: Proper sanitization of user inputs
- **Type Guards**: Custom type guard functions for runtime type safety
- **Error Boundaries**: React error boundaries for graceful error handling

## Performance Optimization Patterns

### Code Splitting
- **Dynamic Imports**: Lazy loading of heavy components and modules
- **Route-Based Splitting**: Code splitting at route boundaries
- **Component Lazy Loading**: Lazy loading of non-critical components
- **Bundle Analysis**: Regular bundle size monitoring and optimization

### Memory Management
- **Cleanup Functions**: Proper cleanup of event listeners and subscriptions
- **Weak References**: Use of WeakMap and WeakSet where appropriate
- **Object Pooling**: Reuse of expensive objects in performance-critical paths
- **Garbage Collection**: Awareness of GC implications in long-running operations

### Rendering Optimization
- **React.memo**: Memoization of expensive components
- **useMemo/useCallback**: Memoization of expensive computations and functions
- **Virtual Scrolling**: Efficient rendering of large lists
- **Debouncing**: Input debouncing for search and filter operations

## Error Handling Standards

### Error Types and Classification
- **Custom Error Classes**: Specific error types for different failure modes
- **Error Boundaries**: React error boundaries for component-level error handling
- **Global Error Handler**: Centralized error logging and reporting
- **User-Friendly Messages**: Meaningful error messages for end users

### Logging and Monitoring
- **Structured Logging**: Consistent log format with appropriate log levels
- **Error Context**: Rich context information in error logs
- **Performance Monitoring**: Tracking of key performance metrics
- **User Activity Tracking**: Non-intrusive user behavior analytics

## Security Patterns

### Input Validation
- **Server-Side Validation**: Never trust client-side validation alone
- **SQL Injection Prevention**: Parameterized queries through Prisma
- **XSS Prevention**: Proper output encoding and sanitization
- **CSRF Protection**: Anti-CSRF tokens for state-changing operations

### Authentication and Authorization
- **JWT Tokens**: Secure token-based authentication
- **Role-Based Access**: Granular permission system
- **API Key Management**: Secure API key generation and rotation
- **Rate Limiting**: Protection against abuse and DoS attacks

## Testing Patterns

### Unit Testing
- **Test Structure**: Arrange-Act-Assert pattern
- **Mock Strategy**: Strategic mocking of external dependencies
- **Test Coverage**: Comprehensive coverage of critical business logic
- **Edge Cases**: Testing of boundary conditions and error scenarios

### Integration Testing
- **API Testing**: End-to-end API testing with real database
- **Component Testing**: Testing of component integration with services
- **Database Testing**: Testing of database operations with test data
- **Error Scenario Testing**: Testing of error handling and recovery

## Documentation Standards

### Code Documentation
- **JSDoc Comments**: Comprehensive function and class documentation
- **Type Annotations**: Self-documenting type definitions
- **README Files**: Clear setup and usage instructions
- **API Documentation**: Detailed API endpoint documentation

### Architecture Documentation
- **System Design**: High-level architecture documentation
- **Data Flow**: Clear documentation of data flow through the system
- **Decision Records**: Documentation of architectural decisions
- **Deployment Guides**: Step-by-step deployment instructions

## Development Workflow

### Git Practices
- **Conventional Commits**: Structured commit messages
- **Feature Branches**: Feature-based branching strategy
- **Pull Request Reviews**: Mandatory code review process
- **Automated Testing**: CI/CD pipeline with automated testing

### Code Quality Tools
- **ESLint Configuration**: Strict linting rules for code consistency
- **Prettier Integration**: Automated code formatting
- **TypeScript Strict Mode**: Strict TypeScript configuration
- **Pre-commit Hooks**: Automated quality checks before commits

## Internationalization Patterns

### Multi-language Support
- **Language Detection**: Automatic language detection and fallback
- **Cultural Context**: Cultural adaptation beyond simple translation
- **RTL Support**: Right-to-left language support
- **Dynamic Loading**: Lazy loading of language resources

### Translation Management
- **Translation Keys**: Structured translation key organization
- **Pluralization**: Proper handling of plural forms
- **Context Preservation**: Maintaining context in translations
- **Quality Assurance**: Translation validation and review processes