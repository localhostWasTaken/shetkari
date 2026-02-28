export default interface ApiResponse{
    statusCode: number; // the status code of the response
    data: any; // the actual response payload
    message: string; // the message for toasting the user
    error: string | null; // the error message for debugging
}