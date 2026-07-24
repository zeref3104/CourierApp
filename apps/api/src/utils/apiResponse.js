class ApiResponse {
  static success(res, data, message = 'Success', meta = null) {
    const response = { success: true, data, message };
    if (meta) response.meta = meta;
    return res.status(200).json(response);
  }

  static created(res, data, message = 'Created successfully') {
    return res.status(201).json({ success: true, data, message });
  }

  static noContent(res) {
    return res.status(204).send();
  }

  static paginated(res, data, meta) {
    return res.status(200).json({ success: true, data, meta });
  }
}

module.exports = ApiResponse;