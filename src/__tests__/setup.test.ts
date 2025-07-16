/**
 * Basic setup test to verify Jest configuration
 */
describe('Project Setup', () => {
  it('should have Jest configured correctly', () => {
    expect(true).toBe(true)
  })

  it('should be able to use TypeScript', () => {
    const testObject: { name: string; value: number } = {
      name: 'test',
      value: 42
    }
    expect(testObject.name).toBe('test')
    expect(testObject.value).toBe(42)
  })
})