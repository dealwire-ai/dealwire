import {
  formatFileSize,
  timeAgo,
  escapeHtml,
  getErrorMessage,
} from './format';

describe('formatFileSize', () => {
  it('returns bytes for values under 1024', () => {
    // Arrange
    const bytes = 512;

    // Act
    const result = formatFileSize(bytes);

    // Assert
    expect(result).toBe('512 B');
  });

  it('returns 0 B for zero bytes', () => {
    // Arrange / Act / Assert
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('returns KB for values between 1024 and 1 MB', () => {
    // Arrange
    const bytes = 5 * 1024; // 5 KB exactly

    // Act
    const result = formatFileSize(bytes);

    // Assert
    expect(result).toBe('5 KB');
  });

  it('rounds KB to nearest integer', () => {
    // Arrange
    const bytes = 1536; // 1.5 KB -> rounds to 2

    // Act
    const result = formatFileSize(bytes);

    // Assert
    expect(result).toBe('2 KB');
  });

  it('returns MB with one decimal for values >= 1 MB', () => {
    // Arrange
    const bytes = 1024 * 1024; // exactly 1 MB

    // Act
    const result = formatFileSize(bytes);

    // Assert
    expect(result).toBe('1.0 MB');
  });

  it('formats fractional MB correctly', () => {
    // Arrange
    const bytes = 2.5 * 1024 * 1024;

    // Act
    const result = formatFileSize(bytes);

    // Assert
    expect(result).toBe('2.5 MB');
  });

  it('returns KB at the 1024 boundary', () => {
    // Arrange
    const bytes = 1024; // exactly 1 KB

    // Act
    const result = formatFileSize(bytes);

    // Assert
    expect(result).toBe('1 KB');
  });
});

describe('timeAgo', () => {
  it('returns "today" for the current time', () => {
    // Arrange
    const now = new Date();

    // Act
    const result = timeAgo(now);

    // Assert
    expect(result).toBe('today');
  });

  it('returns "yesterday" for one day ago', () => {
    // Arrange
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Act
    const result = timeAgo(yesterday);

    // Assert
    expect(result).toBe('yesterday');
  });

  it('returns "X days ago" for 2-29 days', () => {
    // Arrange
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    // Act
    const result = timeAgo(fiveDaysAgo);

    // Assert
    expect(result).toBe('5 days ago');
  });

  it('returns "1 month ago" for 30 days', () => {
    // Arrange
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Act
    const result = timeAgo(thirtyDaysAgo);

    // Assert
    expect(result).toBe('1 month ago');
  });

  it('returns "X months ago" for multiple months', () => {
    // Arrange
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Act
    const result = timeAgo(ninetyDaysAgo);

    // Assert
    expect(result).toBe('3 months ago');
  });
});

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    // Arrange / Act / Assert
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
  });

  it('escapes less-than signs', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes greater-than signs', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#039;s');
  });

  it('escapes all special characters in one string', () => {
    // Arrange
    const input = `<div class="a" data-x='b'>&</div>`;

    // Act
    const result = escapeHtml(input);

    // Assert
    expect(result).toBe(
      '&lt;div class=&quot;a&quot; data-x=&#039;b&#039;&gt;&amp;&lt;/div&gt;',
    );
  });

  it('passes through normal text unchanged', () => {
    // Arrange
    const input = 'Hello, World! 123';

    // Act
    const result = escapeHtml(input);

    // Assert
    expect(result).toBe('Hello, World! 123');
  });
});

describe('getErrorMessage', () => {
  it('extracts message from an Error object', () => {
    // Arrange
    const error = new Error('something went wrong');

    // Act
    const result = getErrorMessage(error);

    // Assert
    expect(result).toBe('something went wrong');
  });

  it('returns the string directly when given a string', () => {
    // Arrange
    const error = 'plain string error';

    // Act
    const result = getErrorMessage(error);

    // Assert
    expect(result).toBe('plain string error');
  });

  it('converts a number to string', () => {
    // Arrange / Act / Assert
    expect(getErrorMessage(404)).toBe('404');
  });

  it('converts null to string', () => {
    expect(getErrorMessage(null)).toBe('null');
  });

  it('converts undefined to string', () => {
    expect(getErrorMessage(undefined)).toBe('undefined');
  });

  it('converts an object to string', () => {
    expect(getErrorMessage({ code: 'FAIL' })).toBe('[object Object]');
  });
});
